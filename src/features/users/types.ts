import type { ActiveStatus, BulkUserItemInput, ID, Role, UserAccountInput } from '@/types/entities'

/** Parameter daftar akun (GET /users). */
export interface UserListParams {
  search?: string
  role?: Role
  status?: ActiveStatus
  /** 'linked' = tertaut ke data guru, 'none' = tanpa tautan. */
  link?: 'linked' | 'none'
  page?: number
  pageSize?: number
  sort?: string
}

/** Body PATCH /users/:id — username diabaikan backend setelah akun dibuat. */
export type UserAccountPatch = Partial<UserAccountInput> & { version: number }

export interface UserStatusInput {
  status: ActiveStatus
  reason?: string
  version: number
}

export interface BulkUserCreateInput {
  items: BulkUserItemInput[]
}

export interface BulkUserStatusInput {
  ids: ID[]
  status: ActiveStatus
  reason?: string
}

export interface BulkUserDeleteInput {
  ids: ID[]
  reason?: string
}

