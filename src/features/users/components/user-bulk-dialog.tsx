import {
  Check,
  CircleAlert,
  CircleCheck,
  ClipboardPaste,
  Copy,
  Download,
  FileSpreadsheet,
  KeyRound,
  Link2,
  Trash2,
  TriangleAlert,
  Upload,
  UserPlus,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CountChip, FramedCard } from '@/components/framed-card'
import { MetaTag, ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCurrentUser } from '@/features/auth/auth-context'
import { useSubmitKey } from '@/features/master-data/components/crud-kit'
import { useTeachers } from '@/features/master-data/lookups'
import { Metric } from '@/features/super-admin/components/metric'
import { todayISO } from '@/lib/date'
import { ROLE_META } from '@/lib/enums'
import { getErrorMessage } from '@/lib/error-mapping'
import { downloadBlob } from '@/lib/export'
import type { BulkCreatedUserResult } from '@/types/entities'
import {
  buildBlankUserTemplateCSV,
  buildBlankUserTemplateExcel,
  buildCredentialsCSV,
  buildCredentialsExcel,
  prepareBulkPreview,
  previewRowToInput,
} from '../bulk-template'
import { useUserMutations, useUsers } from '../queries'

type Mutations = ReturnType<typeof useUserMutations>

/**
 * Dialog Tambah Akun Massal bergaya Nuvio (FramedCard bg-hatch):
 * - Menyediakan unduhan Template Excel (.xls) terformat rapi (beserta opsi CSV).
 * - Mendukung unggah file (.xls, .csv, .tsv) maupun tempel langsung (copy-paste) baris dari Microsoft Excel.
 * - Menampilkan ringkasan Metric & tabel pratinjau validasi, serta unduhan kredensial sementara (.xls / .csv).
 */
export function UserBulkDialog({
  open,
  mutations,
  onClose,
}: {
  open: boolean
  mutations: Mutations
  onClose: () => void
}) {
  const me = useCurrentUser()
  const teachers = useTeachers()
  const allUsersQuery = useUsers({ page: 1, pageSize: 500, sort: 'name' })
  const submitKey = useSubmitKey()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [rawText, setRawText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file')
  const [skipInvalid, setSkipInvalid] = useState(true)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [created, setCreated] = useState<BulkCreatedUserResult[] | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)

  const existingUsers = useMemo(() => allUsersQuery.data?.data ?? [], [allUsersQuery.data])
  const existingTeachers = useMemo(() => teachers.data ?? [], [teachers.data])

  const previewRows = useMemo(
    () => (rawText.trim() ? prepareBulkPreview(rawText, existingUsers, existingTeachers, me.roles) : []),
    [rawText, existingUsers, existingTeachers, me.roles],
  )

  const validRows = useMemo(() => previewRows.filter((r) => r.valid), [previewRows])
  const invalidRows = useMemo(() => previewRows.filter((r) => !r.valid), [previewRows])
  const linkedCount = useMemo(
    () => validRows.filter((r) => r.teacherAction === 'LINKED_EXISTING').length,
    [validRows],
  )
  const newTeacherCount = useMemo(
    () => validRows.filter((r) => r.teacherAction === 'CREATED_NEW').length,
    [validRows],
  )

  const resetAll = () => {
    setRawText('')
    setFileName(null)
    setInputMode('file')
    setSubmitError(null)
    setCreated(null)
    setCopiedAll(false)
    mutations.createBulk.reset()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = () => {
    if (mutations.createBulk.isPending) return
    resetAll()
    onClose()
  }

  const handleDownloadBlankTemplateExcel = () => {
    const xls = buildBlankUserTemplateExcel()
    downloadBlob(
      new Blob([xls], { type: 'application/vnd.ms-excel;charset=utf-8' }),
      `template-akun-epiket-${todayISO()}.xls`,
    )
    toast.success('Template Excel (.xls) berhasil diunduh.')
  }

  const handleDownloadBlankTemplateCSV = () => {
    const csv = buildBlankUserTemplateCSV()
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `template-akun-epiket-${todayISO()}.csv`)
    toast.success('Template CSV berhasil diunduh.')
  }

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return
    setSubmitError(null)
    try {
      const text =
        typeof file.text === 'function'
          ? await file.text()
          : await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
              reader.onerror = () => reject(reader.error ?? new Error('Read failed'))
              reader.readAsText(file)
            })
      setRawText(text)
      setFileName(file.name)
    } catch {
      toast.error('Gagal membaca file. Pastikan file berformat Excel (.xls) atau CSV.')
    }
  }

  const handleSubmitBulk = async () => {
    setSubmitError(null)
    const rowsToSubmit = skipInvalid ? validRows : previewRows
    if (rowsToSubmit.length === 0) return
    const items = rowsToSubmit.map(previewRowToInput)
    try {
      const res = await mutations.createBulk.mutateAsync({
        body: { items },
        idempotencyKey: submitKey({ items }),
      })
      setCreated(res.created)
      toast.success(`${res.created.length} akun berhasil dibuat.`)
    } catch (e) {
      setSubmitError(getErrorMessage(e))
    }
  }

  const handleDownloadCredentialsExcel = () => {
    if (!created || created.length === 0) return
    const xls = buildCredentialsExcel(created)
    downloadBlob(
      new Blob([xls], { type: 'application/vnd.ms-excel;charset=utf-8' }),
      `kredensial-akun-baru-${todayISO()}.xls`,
    )
    toast.success('File Excel kredensial diunduh.')
  }

  const handleDownloadCredentialsCSV = () => {
    if (!created || created.length === 0) return
    const csv = buildCredentialsCSV(created)
    downloadBlob(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      `kredensial-akun-baru-${todayISO()}.csv`,
    )
    toast.success('File CSV kredensial diunduh.')
  }

  const handleCopyAllCredentials = async () => {
    if (!created || created.length === 0) return
    const lines = [
      ['Nama Lengkap', 'Username', 'Kata Sandi Sementara', 'Peran'].join('\t'),
      ...created.map((item) =>
        [
          item.user.name,
          item.user.username,
          item.temporaryPassword,
          item.user.roles.map((r) => ROLE_META[r].label).join(', '),
        ].join('\t'),
      ),
    ].join('\n')
    try {
      await navigator.clipboard.writeText(lines)
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 2000)
      toast.success('Daftar kredensial disalin ke clipboard.')
    } catch {
      toast.error('Tidak dapat menyalin otomatis. Gunakan tombol Unduh Excel atau CSV.')
    }
  }

  const canSubmit =
    validRows.length > 0 &&
    (skipInvalid || invalidRows.length === 0) &&
    !mutations.createBulk.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-4xl"
        onInteractOutside={(e) => {
          if (created || mutations.createBulk.isPending) e.preventDefault()
        }}
      >
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound aria-hidden className="size-4 text-muted-foreground" />
                {created.length} Akun Berhasil Dibuat
              </DialogTitle>
              <DialogDescription>
                Simpan atau unduh daftar kredensial di bawah ini untuk dibagikan kepada guru/staf. Setiap pengguna akan
                diminta mengganti kata sandi sementara saat pertama kali masuk.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-3.5 overflow-y-auto pr-1">
              <Alert variant="warning">
                <TriangleAlert />
                <AlertTitle>Kata sandi sementara hanya ditampilkan sekali</AlertTitle>
                <AlertDescription>
                  Setelah dialog ini ditutup, kata sandi sementara tidak dapat dilihat lagi. Unduh file Excel atau CSV
                  kredensial sekarang sebagai arsip pembagian akun.
                </AlertDescription>
              </Alert>

              <FramedCard
                title="Daftar Kredensial Akun Baru"
                titleId="bulk-creds-card-title"
                headingLevel="h3"
                icon={<KeyRound />}
                titleBadge={<CountChip>{created.length}</CountChip>}
                bodyClassName="p-0 overflow-hidden"
                headerRight={
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyAllCredentials()}>
                      {copiedAll ? <Check className="text-tone-success" /> : <Copy />}
                      {copiedAll ? 'Tersalin' : 'Salin Semua'}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={handleDownloadCredentialsCSV}>
                      <Download /> CSV
                    </Button>
                    <Button type="button" size="sm" onClick={handleDownloadCredentialsExcel}>
                      <Download /> Unduh Excel (.xls)
                    </Button>
                  </div>
                }
              >
                <div className="max-h-72 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama & Username</TableHead>
                        <TableHead>Peran</TableHead>
                        <TableHead>Data Guru</TableHead>
                        <TableHead>Kata Sandi Sementara</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {created.map((item) => (
                        <TableRow key={item.user.id}>
                          <TableCell>
                            <p className="font-medium text-foreground">{item.user.name}</p>
                            <p className="font-mono text-xs text-muted-foreground">{item.user.username}</p>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {item.user.roles.map((r) => (
                                <MetaTag key={r}>{ROLE_META[r].label}</MetaTag>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {item.teacherAction === 'CREATED_NEW' ? (
                              <ToneBadge tone="info">Guru baru dibuat</ToneBadge>
                            ) : item.teacherAction === 'LINKED_EXISTING' ? (
                              <ToneBadge tone="success">Ditautkan ({item.user.teacherName})</ToneBadge>
                            ) : (
                              <span className="text-muted-foreground">Tanpa tautan</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <code
                              data-testid="bulk-temporary-password"
                              className="rounded border border-input bg-muted/40 px-2 py-0.5 font-mono text-xs select-all"
                            >
                              {item.temporaryPassword}
                            </code>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </FramedCard>
            </div>

            <DialogFooter>
              <Button type="button" onClick={handleClose}>
                Selesai
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet aria-hidden className="size-4 text-muted-foreground" />
                Tambah Akun Massal
              </DialogTitle>
              <DialogDescription>
                Unduh template Excel siap pakai, isi daftar guru/staf, lalu unggah kembali. Jika NIP guru belum ada di
                Data Master, sistem otomatis membuatkan data Master Guru-nya sekaligus.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              {/* Kartu Berbingkai 1: Template & Data Guru */}
              <FramedCard
                title="Template & Data Guru"
                titleId="bulk-template-card-title"
                headingLevel="h3"
                icon={<FileSpreadsheet />}
                bodyClassName="p-0 overflow-hidden"
              >
                <div className="divide-y divide-border/60">
                  <div className="flex flex-col gap-2.5 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">Template Standar TU Sekolah</span>
                        <ToneBadge tone="neutral">Siap isi di Excel</ToneBadge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Tabel berformat rapi dengan kop petunjuk, lebar kolom proporsional, dan sel NIP 18 digit
                        terkunci sebagai teks.
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid="download-template-xls"
                        onClick={handleDownloadBlankTemplateExcel}
                      >
                        <Download /> Unduh Excel (.xls)
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        data-testid="download-template-csv"
                        onClick={handleDownloadBlankTemplateCSV}
                      >
                        <Download /> CSV
                      </Button>
                    </div>
                  </div>
                </div>
              </FramedCard>

              {/* Kartu Berbingkai 2: Unggah File atau Tempel dari Excel */}
              <FramedCard
                title="Unggah File atau Tempel dari Excel"
                titleId="bulk-upload-card-title"
                headingLevel="h3"
                icon={<Upload />}
                bodyClassName="p-3"
                headerRight={
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      data-testid="toggle-paste-mode"
                      onClick={() => setInputMode((m) => (m === 'file' ? 'paste' : 'file'))}
                    >
                      {inputMode === 'file' ? (
                        <>
                          <ClipboardPaste className="size-3.5" /> Tempel dari Excel
                        </>
                      ) : (
                        <>
                          <Upload className="size-3.5" /> Pilih File (.xls/.csv)
                        </>
                      )}
                    </Button>
                    {(fileName || rawText.trim()) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRawText('')
                          setFileName(null)
                          setSubmitError(null)
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                      >
                        <Trash2 className="size-3.5" /> Reset{fileName ? ` (${fileName})` : ''}
                      </Button>
                    )}
                  </div>
                }
              >
                {inputMode === 'file' ? (
                  <label
                    htmlFor="bulk-user-file"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      const f = e.dataTransfer.files?.[0]
                      if (f) void handleFileSelected(f)
                    }}
                    className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-4 py-5 text-center transition-colors hover:bg-muted/30"
                  >
                    <Upload aria-hidden className="size-5 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">
                      {fileName
                        ? `File terpilih: ${fileName}`
                        : 'Klik untuk memilih file Excel (.xls) / CSV atau tarik file ke sini'}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Mendukung file Template Excel (.xls), CSV koma (,), titik koma (;) dari Excel Indonesia, maupun
                      TSV.
                    </span>
                    <input
                      ref={fileInputRef}
                      id="bulk-user-file"
                      data-testid="bulk-file-input"
                      type="file"
                      accept=".xls,.csv,.txt,.tsv,application/vnd.ms-excel,text/csv,text/plain"
                      className="sr-only"
                      onChange={(e) => void handleFileSelected(e.target.files?.[0])}
                    />
                  </label>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="bulk-paste-area" className="text-xs text-muted-foreground">
                      Salin baris tabel dari Microsoft Excel / Google Sheets lalu tempel (Ctrl+V) di bawah ini:
                    </Label>
                    <textarea
                      id="bulk-paste-area"
                      data-testid="bulk-paste-textarea"
                      value={rawText}
                      onChange={(e) => {
                        setRawText(e.target.value)
                        setFileName(null)
                        setSubmitError(null)
                      }}
                      rows={4}
                      placeholder={
                        '1\tBudi Santoso, S.Pd.\t198803152014021001\tGuru\tbudi@sekolah.sch.id\t081234567801\n2\tSiti Rahma, M.Pd.\t199107222019032004\tGuru; Wali Kelas\tsiti@sekolah.sch.id\t081234567802'
                      }
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    />
                  </div>
                )}
              </FramedCard>

              {/* Bagian 3: Ringkasan Metric & Tabel Pratinjau */}
              {previewRows.length > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Metric
                      label="Siap dibuat"
                      value={validRows.length}
                      hint={`${validRows.length} siap dibuat`}
                      icon={<CircleCheck />}
                      iconClassName="text-tone-success"
                    />
                    <Metric
                      label="Tautkan guru"
                      value={linkedCount}
                      hint="Ke Master Guru"
                      icon={<Link2 />}
                    />
                    <Metric
                      label="Guru baru"
                      value={newTeacherCount}
                      hint="Dibuat otomatis"
                      icon={<UserPlus />}
                    />
                    <Metric
                      label="Perlu dicek"
                      value={invalidRows.length}
                      hint={invalidRows.length > 0 ? `${invalidRows.length} bermasalah` : 'Semua baris valid'}
                      icon={invalidRows.length > 0 ? <CircleAlert /> : undefined}
                      iconClassName={invalidRows.length > 0 ? 'text-tone-danger' : undefined}
                    />
                  </div>

                  <FramedCard
                    title="Pratinjau & Validasi Baris"
                    titleId="bulk-preview-card-title"
                    headingLevel="h3"
                    titleBadge={<CountChip>{previewRows.length}</CountChip>}
                    bodyClassName="p-0 overflow-hidden"
                    headerRight={
                      invalidRows.length > 0 && validRows.length > 0 ? (
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                          <Checkbox
                            checked={skipInvalid}
                            onCheckedChange={(v) => setSkipInvalid(v === true)}
                          />
                          Lewati {invalidRows.length} baris bermasalah
                        </label>
                      ) : undefined
                    }
                  >
                    <div className="max-h-60 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            <TableHead>Nama & Username</TableHead>
                            <TableHead>Peran</TableHead>
                            <TableHead>Tautan Guru (NIP)</TableHead>
                            <TableHead>Status Validasi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewRows.map((row) => (
                            <TableRow key={row.rowNumber} className={!row.valid ? 'bg-destructive/5' : undefined}>
                              <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                                {row.rowNumber}
                              </TableCell>
                              <TableCell>
                                <p className="font-medium text-foreground">{row.name || '—'}</p>
                                <p className="font-mono text-xs text-muted-foreground">
                                  {row.username}
                                  {row.usernameAuto && <span className="ml-1 text-[11px] italic">(otomatis)</span>}
                                </p>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {row.roles.map((r) => (
                                    <MetaTag key={r}>{ROLE_META[r].label}</MetaTag>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs">
                                {row.teacherAction === 'LINKED_EXISTING' ? (
                                  <ToneBadge tone="info">{row.teacherLabel}</ToneBadge>
                                ) : row.teacherAction === 'CREATED_NEW' ? (
                                  <ToneBadge tone="warning">{row.teacherLabel}</ToneBadge>
                                ) : (
                                  <span className="text-muted-foreground">{row.teacherLabel}</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">
                                {row.valid ? (
                                  <span className="inline-flex items-center gap-1 font-medium text-tone-success">
                                    <CircleCheck className="size-3.5" /> Siap dibuat
                                  </span>
                                ) : (
                                  <span className="inline-flex items-start gap-1 text-destructive">
                                    <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                                    <span>{row.errors.join(' ')}</span>
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </FramedCard>
                </div>
              )}

              {submitError && (
                <Alert variant="destructive">
                  <CircleAlert />
                  <AlertTitle>Gagal membuat akun massal</AlertTitle>
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={mutations.createBulk.isPending}>
                Batal
              </Button>
              <Button type="button" onClick={() => void handleSubmitBulk()} disabled={!canSubmit}>
                {mutations.createBulk.isPending
                  ? 'Membuat akun…'
                  : `Buat ${validRows.length} Akun`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
