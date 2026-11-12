import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CalendarCheck2,
  CircleAlert,
  ClipboardPaste,
  Download,
  FileSpreadsheet,
  Sparkles,
  Trash2,
  Upload,
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
import { Metric } from '@/features/super-admin/components/metric'
import { getErrorMessage } from '@/lib/error-mapping'
import { downloadBlob } from '@/lib/export'
import type { Teacher } from '@/types/entities'
import { masterApi } from '../api'
import { masterKeys, useActiveAcademicYear } from '../lookups'
import {
  DAYS_MON_SAT,
  buildPresenceMatrixCSV,
  buildPresenceMatrixExcel,
  parsePresenceMatrixFile,
} from '../presence-matrix-template'
import { useSubmitKey } from './crud-kit'

export function PresenceMatrixImportDialog({
  open,
  teachers,
  onClose,
}: {
  open: boolean
  teachers: Teacher[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { year, semester } = useActiveAcademicYear()
  const submitKey = useSubmitKey()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [rawText, setRawText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file')
  const [replaceSchedule, setReplaceSchedule] = useState(true)
  const [createAccounts, setCreateAccounts] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const parsed = useMemo(
    () =>
      rawText.trim()
        ? parsePresenceMatrixFile(rawText, teachers)
        : { items: [], rowCount: 0, updatedCount: 0, newCount: 0, unlinkedCount: 0 },
    [rawText, teachers],
  )

  const importMutation = useMutation({
    mutationFn: () => {
      const body = {
        items: parsed.items.map((item) => ({
          code: item.code,
          name: item.name,
          attendanceDays: item.attendanceDays,
          attendanceOrder: item.attendanceOrder,
        })),
        replaceSchedule,
        createAccounts,
      }
      return masterApi.teachers.importPresenceMatrix(body, {
        idempotencyKey: submitKey(body),
      })
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: masterKeys.teachers() })
      void qc.invalidateQueries({ queryKey: ['teacher-attendance'] })
      void qc.invalidateQueries({ queryKey: ['users'] })
      const accountNote =
        res.accountsCreatedCount > 0 ? `, serta ${res.accountsCreatedCount} akun login dibuat` : ''
      toast.success(
        `Jadwal kehadiran berhasil disimpan (${res.updatedCount} guru diperbarui, ${res.createdCount} guru baru${accountNote}).`,
      )
      handleClose()
    },
    onError: (err) => {
      setSubmitError(getErrorMessage(err))
    },
  })

  const resetState = () => {
    setRawText('')
    setFileName(null)
    setSubmitError(null)
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const readFileText = async (file: File): Promise<string> => {
    if (typeof file.text === 'function') {
      return file.text()
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
      reader.onerror = () => reject(reader.error ?? new Error('Gagal membaca file'))
      reader.readAsText(file)
    })
  }

  const handleFileChange = async (file: File | null) => {
    if (!file) return
    setFileName(file.name)
    setSubmitError(null)
    const text = await readFileText(file)
    setRawText(text)
  }

  const handleDownloadExcel = () => {
    const xls = buildPresenceMatrixExcel(teachers, {
      schoolName: 'SMK PLUS PELITA NUSANTARA BOGOR',
      academicYear: year?.name ?? '2026/2027',
      semester: semester?.name ?? 'Ganjil',
    })
    downloadBlob(
      new Blob([xls], { type: 'application/vnd.ms-excel;charset=utf-8' }),
      'jadwal-kehadiran-guru-senin-sabtu.xls',
    )
  }

  const handleDownloadCsv = () => {
    const csv = buildPresenceMatrixCSV(teachers)
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'jadwal-kehadiran-guru-senin-sabtu.csv')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck2 className="size-5 text-primary" />
            Impor Matriks Jadwal Kehadiran Guru (Senin–Sabtu)
          </DialogTitle>
          <DialogDescription>
            Unggah file Excel (<code className="font-mono text-xs">.xls</code>) atau CSV berformat matriks 6 hari (
            <code className="font-mono text-xs">NO | SENIN | KODE | ... | SABTU | KODE</code>) seperti dokumen resmi
            sekolah.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <FramedCard
            title={
              <span className="flex items-center gap-2">
                <span className="inline-flex size-5 items-center justify-center rounded-md bg-primary/10 font-mono text-xs font-semibold text-primary">
                  1
                </span>
                Template Matriks 6 Hari (Excel & CSV)
              </span>
            }
            description="Unduh matriks saat ini untuk diedit di Microsoft Excel lalu unggah kembali"
            headerRight={
              <Button type="button" variant="ghost" size="sm" onClick={handleDownloadCsv}>
                <Download className="size-3.5" />
                Format CSV (.csv)
              </Button>
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Format Kolom: NO · SENIN · KODE · SELASA · KODE · RABU · KODE · KAMIS · KODE · JUMAT · KODE · SABTU ·
                  KODE
                </p>
                <p className="text-xs text-muted-foreground">
                  Sistem otomatis menggabungkan hari hadir setiap guru berdasarkan <strong>Kode Guru</strong> atau{' '}
                  <strong>Nama Guru</strong>.
                </p>
              </div>
              <Button type="button" size="sm" onClick={handleDownloadExcel}>
                <FileSpreadsheet className="size-4" />
                Unduh Template Matriks (.xls)
              </Button>
            </div>
          </FramedCard>

          <FramedCard
            title={
              <span className="flex items-center gap-2">
                <span className="inline-flex size-5 items-center justify-center rounded-md bg-primary/10 font-mono text-xs font-semibold text-primary">
                  2
                </span>
                Sumber Data Matriks
              </span>
            }
            headerRight={
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant={inputMode === 'file' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setInputMode('file')}
                >
                  <Upload className="size-3.5" />
                  Unggah File
                </Button>
                <Button
                  type="button"
                  variant={inputMode === 'paste' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setInputMode('paste')}
                >
                  <ClipboardPaste className="size-3.5" />
                  Tempel dari Excel
                </Button>
                {rawText.trim() && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetState}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                    Bersihkan
                  </Button>
                )}
              </div>
            }
          >
            {inputMode === 'file' ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const f = e.dataTransfer.files?.[0] ?? null
                  void handleFileChange(f)
                }}
                className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/15 px-4 py-6 text-center transition-colors hover:bg-muted/30"
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Upload className="size-5" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">
                    {fileName ? `File terpilih: ${fileName}` : 'Pilih file matriks Excel (.xls) atau CSV (.csv)'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tarik & lepas file ke area ini, atau klik tombol di bawah untuk memilih dari komputer.
                  </p>
                </div>
                <div className="pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <FileSpreadsheet className="size-4" />
                    {fileName ? 'Ganti File Template' : 'Pilih File (.xls / .csv)'}
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xls,.csv,.tsv,.txt,application/vnd.ms-excel,text/csv,text/plain"
                  aria-label="Pilih file matriks kehadiran guru"
                  className="sr-only"
                  onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
                />
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="matrix-paste-area" className="text-xs text-muted-foreground">
                  Salin blok tabel <code className="font-mono">NO | SENIN | KODE | ... | SABTU | KODE</code> dari Excel
                  lalu tempel di bawah ini:
                </Label>
                <textarea
                  id="matrix-paste-area"
                  rows={5}
                  value={rawText}
                  onChange={(e) => {
                    setFileName(null)
                    setRawText(e.target.value)
                    setSubmitError(null)
                  }}
                  placeholder={
                    'NO\tSENIN\tKODE\tSELASA\tKODE\tRABU\tKODE\tKAMIS\tKODE\tJUMAT\tKODE\tSABTU\tKODE\n1\tSeptianto Raharso, S.Kom., M.Pd.\t21\tPutri Ngawirabaya, S.S\t16\t...'
                  }
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
            )}
          </FramedCard>

          {submitError && (
            <Alert variant="destructive">
              <CircleAlert className="size-4" />
              <AlertTitle>Gagal menyimpan matriks kehadiran</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          {parsed.items.length > 0 && (
            <FramedCard
              title={
                <span className="flex items-center gap-2">
                  <span className="inline-flex size-5 items-center justify-center rounded-md bg-primary/10 font-mono text-xs font-semibold text-primary">
                    3
                  </span>
                  Pratinjau Hasil Ekstraksi Matriks
                </span>
              }
              headerRight={<CountChip>{parsed.items.length} guru terdeteksi</CountChip>}
              bodyClassName="p-0"
            >
              <div className="grid grid-cols-2 divide-y divide-border/70 border-b border-border/70 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
                <Metric label="Guru Terjadwal" value={parsed.items.length} hint={`${parsed.rowCount} baris matriks`} />
                <Metric label="Guru Terdaftar" value={parsed.updatedCount} hint="Jadwal hadir diperbarui" />
                <Metric label="Guru Baru" value={parsed.newCount} hint="Otomatis ditambah ke Master" />
                <Metric label="Belum Berakun" value={parsed.unlinkedCount} hint="Dapat dibuatkan akun sekaligus" />
              </div>

              <div className="flex flex-col gap-2.5 border-b border-border/70 bg-muted/20 px-4 py-3 text-xs">
                <label className="flex cursor-pointer items-center gap-2 select-none">
                  <Checkbox checked={replaceSchedule} onCheckedChange={(v) => setReplaceSchedule(Boolean(v))} />
                  <span>
                    Ganti jadwal kehadiran lama dengan matriks ini (mereset hari hadir guru yang tidak tercantum di file
                    ini)
                  </span>
                </label>
                {parsed.unlinkedCount > 0 && (
                  <label className="flex cursor-pointer items-center gap-2 select-none">
                    <Checkbox checked={createAccounts} onCheckedChange={(v) => setCreateAccounts(Boolean(v))} />
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <Sparkles className="size-3.5 text-primary" />
                      Sekaligus buatkan akun login untuk {parsed.unlinkedCount} guru yang belum memiliki akun (Kata
                      sandi awal: <code className="font-mono">Guru12345</code>)
                    </span>
                  </label>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Kode</TableHead>
                      <TableHead>Nama Guru</TableHead>
                      <TableHead>Hari Kehadiran (Senin–Sabtu)</TableHead>
                      <TableHead className="w-36">Status Master</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.items.map((item) => (
                      <TableRow key={`${item.code}-${item.name}`}>
                        <TableCell className="font-mono text-xs font-semibold tabular-nums">
                          {item.code || '—'}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{item.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            {DAYS_MON_SAT.map((d) => {
                              const active = item.attendanceDays.includes(d.day)
                              return (
                                <span
                                  key={d.day}
                                  className={
                                    active
                                      ? 'inline-flex items-center rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary'
                                      : 'inline-flex items-center rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground/50'
                                  }
                                >
                                  {d.short}
                                </span>
                              )
                            })}
                            <MetaTag className="ml-1">{item.attendanceDays.length} hr</MetaTag>
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.isExisting ? (
                            <ToneBadge tone="success">Diperbarui</ToneBadge>
                          ) : (
                            <ToneBadge tone="info">Guru Baru</ToneBadge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </FramedCard>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Batal
          </Button>
          <Button
            type="button"
            disabled={parsed.items.length === 0 || importMutation.isPending}
            onClick={() => importMutation.mutate()}
          >
            {importMutation.isPending ? 'Menyimpan…' : `Simpan Jadwal (${parsed.items.length} Guru)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
