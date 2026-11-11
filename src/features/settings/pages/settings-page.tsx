import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, RefreshCw, Save, Undo2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { FormProvider, useForm, type FieldErrors } from 'react-hook-form'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { ErrorState, Page, PageHeader } from '@/components/page'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle, Skeleton } from '@/components/ui/misc'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UnsavedChangesGuard } from '@/components/unsaved-changes'
import { useSettings } from '@/features/master-data/lookups'
import { ApiError } from '@/lib/api-client'
import { applyServerErrors, getErrorMessage } from '@/lib/error-mapping'
import type { SchoolSettings } from '@/types/entities'
import { AttendanceStatusSection } from '../components/attendance-status-section'
import { IdentitySection } from '../components/identity-section'
import { DismissalSection, DutyCategoriesSection, MasterInfoCard, TeacherRulesSection } from '../components/rule-sections'
import { useUpdateSettings } from '../queries'
import {
  SECTION_FIELDS,
  settingsFormSchema,
  toFormValues,
  toPatch,
  type SettingsFormValues,
  type SettingsSection,
} from '../schemas'

const TABS: { value: SettingsSection; label: string }[] = [
  { value: 'identitas', label: 'Identitas & Kop Cetak' },
  { value: 'status-absensi', label: 'Status Absensi' },
  { value: 'aturan-guru', label: 'Aturan Guru' },
  { value: 'kepulangan', label: 'Kepulangan' },
  { value: 'kategori-piket', label: 'Kategori Catatan Piket' },
]

function isSection(v: string | null): v is SettingsSection {
  return !!v && v in SECTION_FIELDS
}

function sectionsWithErrors(errors: FieldErrors<SettingsFormValues>): SettingsSection[] {
  return (Object.keys(SECTION_FIELDS) as SettingsSection[]).filter((s) =>
    (SECTION_FIELDS[s] as readonly (keyof SettingsFormValues)[]).some((f) => !!errors[f]),
  )
}

export function SettingsPage() {
  const settings = useSettings()

  return (
    <Page>
      <PageHeader
        title="Pengaturan"
        description="Identitas sekolah, kop cetak, status absensi, dan aturan pencatatan harian. Setiap perubahan tercatat di audit log."
      />
      {settings.isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Memuat pengaturan">
          <Skeleton className="h-8 w-full max-w-2xl" />
          <div className="grid gap-5 lg:grid-cols-2">
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        </div>
      ) : settings.isError ? (
        <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
      ) : (
        <SettingsForm settings={settings.data} onReload={() => settings.refetch()} />
      )}
    </Page>
  )
}

function SettingsForm({
  settings,
  onReload,
}: {
  settings: SchoolSettings
  onReload: () => Promise<{ data?: SchoolSettings }>
}) {
  const [sp, setSp] = useSearchParams()
  const tabParam = sp.get('tab')
  const tab: SettingsSection = isSection(tabParam) ? tabParam : 'identitas'
  const setTab = (v: string) =>
    setSp(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (v === 'identitas') next.delete('tab')
        else next.set('tab', v)
        return next
      },
      { replace: true },
    )

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: toFormValues(settings),
    mode: 'onBlur',
  })
  const { isDirty, errors } = form.formState
  /** Versi yang menjadi dasar suntingan — dikirim untuk optimistic locking (409 bila basi). */
  const [baseVersion, setBaseVersion] = useState(settings.version)
  const [conflict, setConflict] = useState(false)
  const mutation = useUpdateSettings()

  // Sinkronkan form dengan data server bila pengguna belum menyunting.
  useEffect(() => {
    if (form.formState.isDirty) return
    form.reset(toFormValues(settings))
    setBaseVersion(settings.version)
  }, [settings, form])

  const reloadLatest = async () => {
    const res = await onReload()
    if (res.data) {
      form.reset(toFormValues(res.data))
      setBaseVersion(res.data.version)
      setConflict(false)
      toast.info('Pengaturan terbaru dimuat. Silakan ulangi perubahan Anda bila masih diperlukan.')
    }
  }

  const onSubmit = form.handleSubmit(
    (values) => {
      if (mutation.isPending) return
      mutation.mutate(toPatch(values, baseVersion), {
        onSuccess: (data) => {
          form.reset(toFormValues(data))
          setBaseVersion(data.version)
          setConflict(false)
          toast.success('Pengaturan berhasil disimpan.')
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) {
            setConflict(true)
            toast.error(err.message)
            return
          }
          if (applyServerErrors(err, form.setError)) {
            const bad = sectionsWithErrors(form.formState.errors)
            if (bad[0] && !bad.includes(tab)) setTab(bad[0])
            toast.error('Periksa kembali isian yang ditandai.')
            return
          }
          toast.error(getErrorMessage(err))
        },
      })
    },
    (errs) => {
      const bad = sectionsWithErrors(errs)
      if (bad[0] && !bad.includes(tab)) setTab(bad[0])
      toast.error('Periksa kembali isian yang ditandai.')
    },
  )

  const errorTabs = sectionsWithErrors(errors)

  return (
    <FormProvider {...form}>
      <UnsavedChangesGuard when={isDirty && !mutation.isPending} />
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-5">
        {conflict && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Pengaturan telah diubah pengguna lain</AlertTitle>
            <AlertDescription>
              <p>
                Perubahan Anda belum disimpan karena versi pengaturan sudah berbeda. Muat ulang untuk melihat versi
                terbaru, lalu ulangi perubahan Anda.
              </p>
              <Button type="button" variant="outline" size="sm" className="mt-1" onClick={() => void reloadLatest()}>
                <RefreshCw /> Muat versi terbaru
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full justify-start sm:w-fit" aria-label="Bagian pengaturan">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="flex-none">
                {t.label}
                {errorTabs.includes(t.value) && (
                  <span className="size-1.5 rounded-full bg-destructive" aria-label="(ada kesalahan)" role="img" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="identitas" forceMount hidden={tab !== 'identitas'}>
            <IdentitySection />
          </TabsContent>
          <TabsContent value="status-absensi" forceMount hidden={tab !== 'status-absensi'}>
            <AttendanceStatusSection />
          </TabsContent>
          <TabsContent value="aturan-guru" forceMount hidden={tab !== 'aturan-guru'} className="flex flex-col gap-5">
            <TeacherRulesSection />
            <MasterInfoCard />
          </TabsContent>
          <TabsContent value="kepulangan" forceMount hidden={tab !== 'kepulangan'}>
            <DismissalSection />
          </TabsContent>
          <TabsContent value="kategori-piket" forceMount hidden={tab !== 'kategori-piket'}>
            <DutyCategoriesSection />
          </TabsContent>
        </Tabs>

        <div className="sticky bottom-16 z-20 -mx-3 flex flex-wrap items-center justify-end gap-2 border-t border-border/70 bg-background/95 px-3 py-3 backdrop-blur sm:-mx-6 sm:px-6 md:bottom-0">
          <p className="mr-auto text-xs text-muted-foreground" aria-live="polite">
            {isDirty ? 'Ada perubahan yang belum disimpan.' : `Tersimpan · versi ${baseVersion}`}
          </p>
          <Button
            type="button"
            variant="ghost"
            disabled={!isDirty || mutation.isPending}
            onClick={() => form.reset()}
          >
            <Undo2 /> Batalkan perubahan
          </Button>
          <Button type="submit" disabled={!isDirty || mutation.isPending}>
            <Save /> {mutation.isPending ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}
