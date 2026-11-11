import { Ban, CircleCheck, History, KeyRound, Pencil, SearchX, UserPlus, UsersRound } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Avatar } from '@/components/avatar'
import { DataTable, type ColumnDef } from '@/components/data-table'
import { FilterBar, FilterSelect, SearchInput, useFilters } from '@/components/filter-bar'
import { EmptyState, ErrorState, Page, PageHeader, TableSkeleton } from '@/components/page'
import { RowActionsMenu, type RowAction } from '@/components/row-actions-menu'
import { SegmentedControl } from '@/components/segmented-control'
import { MetaTag, StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { useAuth, useCurrentUser } from '@/features/auth/auth-context'
import { MobileCard } from '@/features/master-data/components/crud-kit'
import { formatDateTime } from '@/lib/date'
import { ACCOUNT_STATUS_META, enumOptions, ROLE_META } from '@/lib/enums'
import { ROLES, type ActiveStatus, type Role, type UserAccount } from '@/types/entities'
import { ResetPasswordDialog } from '../components/reset-password-dialog'
import { TemporaryPasswordDialog, type TemporaryPasswordInfo } from '../components/temporary-password-dialog'
import { auditHrefForActor, UserDetailSheet } from '../components/user-detail-sheet'
import { UserFormDialog } from '../components/user-form-dialog'
import { UserStatusDialog } from '../components/user-status-dialog'
import { useUserMutations, useUsers } from '../queries'
import type { UserListParams } from '../types'

const FILTER_DEFAULTS = { q: '', role: '', status: '', link: '', page: '1' }
const PAGE_SIZE = 20

type StatusSegment = 'ALL' | ActiveStatus
const STATUS_SEGMENTS = [
  { value: 'ALL', label: 'Semua' },
  { value: 'ACTIVE', label: 'Aktif' },
  { value: 'INACTIVE', label: 'Nonaktif' },
] as const satisfies readonly { value: StatusSegment; label: string }[]

const isRole = (v: string): v is Role => (ROLES as readonly string[]).includes(v)
const isStatus = (v: string): v is ActiveStatus => v === 'ACTIVE' || v === 'INACTIVE'
const isLink = (v: string): v is 'linked' | 'none' => v === 'linked' || v === 'none'

type FormState = { mode: 'create' } | { mode: 'edit'; account: UserAccount } | null

export function UsersPage() {
  const me = useCurrentUser()
  const { can } = useAuth()
  const canWrite = can('user:write')
  const urlFilters = useFilters(FILTER_DEFAULTS)
  const { values } = urlFilters
  const setFilter = urlFilters.set

  const params = useMemo<UserListParams>(
    () => ({
      search: values.q.trim() || undefined,
      role: isRole(values.role) ? values.role : undefined,
      status: isStatus(values.status) ? values.status : undefined,
      link: isLink(values.link) ? values.link : undefined,
      page: Number(values.page) || 1,
      pageSize: PAGE_SIZE,
      sort: 'name',
    }),
    [values.q, values.role, values.status, values.link, values.page],
  )
  const users = useUsers(params)
  const mutations = useUserMutations()

  const [form, setForm] = useState<FormState>(null)
  const [detail, setDetail] = useState<UserAccount | null>(null)
  const [toReset, setToReset] = useState<UserAccount | null>(null)
  const [toToggle, setToToggle] = useState<UserAccount | null>(null)
  const [tempPassword, setTempPassword] = useState<TemporaryPasswordInfo | null>(null)

  const { create: createMutation, resetPassword: resetMutation } = mutations
  /** Buang kata sandi sementara dari state & hasil mutasi agar tidak tertinggal setelah dialog ditutup. */
  const closeTempPassword = useCallback(() => {
    setTempPassword(null)
    createMutation.reset()
    resetMutation.reset()
  }, [createMutation, resetMutation])

  const onSearch = useCallback((q: string) => setFilter({ q }), [setFilter])

  const actionsFor = useCallback(
    (u: UserAccount): RowAction[] => {
      const self = u.id === me.id
      return [
        { label: 'Ubah', icon: Pencil, onSelect: () => setForm({ mode: 'edit', account: u }), hidden: !canWrite },
        {
          label: self ? 'Reset kata sandi (akun sendiri)' : 'Reset kata sandi',
          icon: KeyRound,
          onSelect: () => setToReset(u),
          disabled: self || u.status !== 'ACTIVE',
          hidden: !canWrite,
        },
        { label: 'Ganti kata sandi saya', icon: KeyRound, href: '/profil', hidden: !self },
        { label: 'Riwayat aktivitas', icon: History, href: auditHrefForActor(u.id) },
        u.status === 'ACTIVE'
          ? {
              label: self ? 'Nonaktifkan (akun sendiri)' : 'Nonaktifkan',
              icon: Ban,
              onSelect: () => setToToggle(u),
              destructive: true,
              separated: true,
              disabled: self,
              hidden: !canWrite,
            }
          : {
              label: 'Aktifkan',
              icon: CircleCheck,
              onSelect: () => setToToggle(u),
              separated: true,
              hidden: !canWrite,
            },
      ]
    },
    [me.id, canWrite],
  )

  const columns = useMemo<ColumnDef<UserAccount, unknown>[]>(
    () => [
      {
        id: 'user',
        header: 'Pengguna',
        enableSorting: false,
        cell: ({ row }) => <UserCell user={row.original} self={row.original.id === me.id} />,
      },
      {
        id: 'roles',
        header: 'Peran',
        enableSorting: false,
        meta: { className: 'max-w-72' },
        cell: ({ row }) => <RoleTags roles={row.original.roles} />,
      },
      {
        id: 'teacher',
        header: 'Guru tertaut',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.teacherName ?? <span className="text-muted-foreground">Tidak ditautkan</span>,
      },
      {
        id: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="grid gap-0.5">
            <StatusBadge meta={ACCOUNT_STATUS_META} value={row.original.status} />
            {row.original.mustChangePassword && (
              <span className="text-[11px] text-muted-foreground">Sandi sementara</span>
            )}
          </div>
        ),
      },
      {
        id: 'lastLogin',
        header: 'Terakhir masuk',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {row.original.lastLoginAt ? (
              formatDateTime(row.original.lastLoginAt)
            ) : (
              <span className="text-muted-foreground">Belum pernah</span>
            )}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        enableSorting: false,
        meta: { headerClassName: 'w-12', className: 'text-right' },
        cell: ({ row }) => (
          <div className="flex justify-end">
            <RowActionsMenu label={`Aksi untuk ${row.original.name}`} actions={actionsFor(row.original)} />
          </div>
        ),
      },
    ],
    [me.id, actionsFor],
  )

  const statusSegment: StatusSegment = isStatus(values.status) ? values.status : 'ALL'
  const addButton = canWrite && (
    <Button onClick={() => setForm({ mode: 'create' })}>
      <UserPlus /> Tambah Akun
    </Button>
  )

  return (
    <Page>
      <PageHeader
        title="Kelola Pengguna"
        description="Akun, peran, dan tautan data guru seluruh pengguna sekolah. Akun tidak dihapus — nonaktifkan bila tidak dipakai."
        actions={addButton}
      />

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedControl
          ariaLabel="Status akun"
          value={statusSegment}
          onChange={(v) => setFilter({ status: v === 'ALL' ? '' : v })}
          options={STATUS_SEGMENTS}
        />
        <FilterBar onReset={urlFilters.isDirty ? urlFilters.reset : undefined}>
          <SearchInput label="Cari pengguna" placeholder="Nama, username, email…" value={values.q} onChange={onSearch} />
          <FilterSelect
            label="Peran"
            value={values.role}
            onChange={(role) => setFilter({ role })}
            options={enumOptions(ROLE_META)}
            allLabel="Semua peran"
          />
          <FilterSelect
            label="Tautan guru"
            value={values.link}
            onChange={(link) => setFilter({ link })}
            options={[
              { value: 'linked', label: 'Tertaut' },
              { value: 'none', label: 'Tanpa tautan' },
            ]}
            allLabel="Semua"
          />
        </FilterBar>
      </div>

      {users.isPending ? (
        <TableSkeleton rows={8} cols={6} />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => void users.refetch()} />
      ) : (
        <div className={users.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined} aria-busy={users.isFetching}>
          <DataTable
            title="Daftar akun"
            icon={<UsersRound />}
            caption="Daftar akun pengguna"
            columns={columns}
            data={users.data.data}
            getRowId={(r) => r.id}
            onRowClick={setDetail}
            serverPagination={{
              meta: users.data.meta,
              onPageChange: (p) => setFilter({ page: String(p) }),
            }}
            renderMobileCard={(u) => (
              <MobileCard
                title={
                  <span className="flex items-center gap-2">
                    <Avatar name={u.name} size="sm" />
                    {u.name}
                  </span>
                }
                badge={<StatusBadge meta={ACCOUNT_STATUS_META} value={u.status} />}
                lines={[
                  <span key="u" className="font-mono">
                    {u.username}
                    {u.id === me.id ? ' · Anda' : ''}
                  </span>,
                  u.roles.map((r) => ROLE_META[r].label).join(', '),
                  u.teacherName ? `Guru: ${u.teacherName}` : null,
                  `Terakhir masuk: ${u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'belum pernah'}`,
                ]}
                actions={<RowActionsMenu label={`Aksi untuk ${u.name}`} actions={actionsFor(u)} />}
              />
            )}
            emptyState={
              urlFilters.isDirty ? (
                <EmptyState
                  icon={<SearchX className="size-5" />}
                  title="Tidak ada akun yang cocok"
                  description="Ubah kata kunci atau reset filter."
                  action={
                    <Button variant="outline" size="sm" onClick={urlFilters.reset}>
                      Reset filter
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<UsersRound className="size-5" />}
                  title="Belum ada akun"
                  description="Buat akun agar guru dan staf dapat masuk ke E-Piket."
                  action={addButton || undefined}
                />
              )
            }
          />
        </div>
      )}

      {form && (
        <UserFormDialog
          key={form.mode === 'edit' ? form.account.id : 'new'}
          account={form.mode === 'edit' ? form.account : null}
          mutations={mutations}
          onClose={() => setForm(null)}
          onCreated={(res) => {
            setForm(null)
            setTempPassword({
              name: res.user.name,
              username: res.user.username,
              password: res.temporaryPassword,
              kind: 'create',
            })
          }}
        />
      )}
      <ResetPasswordDialog
        account={toReset}
        mutations={mutations}
        onOpenChange={(o) => !o && setToReset(null)}
        onDone={(info) => {
          setToReset(null)
          setTempPassword(info)
        }}
      />
      <UserStatusDialog account={toToggle} mutations={mutations} onOpenChange={(o) => !o && setToToggle(null)} />
      <TemporaryPasswordDialog info={tempPassword} onClose={closeTempPassword} />
      <UserDetailSheet account={detail} onClose={() => setDetail(null)} />
    </Page>
  )
}

function UserCell({ user, self }: { user: UserAccount; self: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar name={user.name} size="md" variant={self ? 'solid' : 'muted'} />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate font-medium text-foreground">
          {user.name}
          {self && <MetaTag>Anda</MetaTag>}
        </p>
        <p className="truncate font-mono text-xs text-muted-foreground">{user.username}</p>
      </div>
    </div>
  )
}

function RoleTags({ roles }: { roles: Role[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <MetaTag key={r}>{ROLE_META[r].label}</MetaTag>
      ))}
    </div>
  )
}
