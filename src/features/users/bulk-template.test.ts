import { describe, expect, it } from 'vitest'
import {
  buildBlankUserTemplateCSV,
  buildBlankUserTemplateExcel,
  buildCredentialsCSV,
  buildCredentialsExcel,
  buildUnlinkedTeachersTemplateCSV,
  buildUnlinkedTeachersTemplateExcel,
  parseDelimitedText,
  parseRoleCell,
  prepareBulkPreview,
  suggestUniqueUsername,
  TEMPLATE_HEADERS,
} from './bulk-template'

describe('bulk-template utilities', () => {
  it('TEMPLATE_HEADERS menggunakan urutan standar TU Sekolah yang rapi', () => {
    expect(TEMPLATE_HEADERS).toEqual([
      'No',
      'Nama Lengkap *',
      'NIP',
      'Peran',
      'Email',
      'No. Telepon',
      'Username (Opsional)',
      'Kata Sandi Awal (Opsional)',
    ])
  })

  it('suggestUniqueUsername membersihkan gelar dan menangani duplikat', () => {
    const taken = new Set(['rina.marlina'])
    expect(suggestUniqueUsername('Drs. Budi Santoso, M.Pd.', '19850101', taken)).toBe('budi.santoso')
    expect(suggestUniqueUsername('Rina Marlina, S.Pd.', '19890202201504', taken)).toBe('rina.marlina.1504')
  })

  it('parseRoleCell mengenali kode enum maupun nama Bahasa Indonesia', () => {
    expect(parseRoleCell('')).toEqual({ roles: ['TEACHER'], unknownTokens: [] })
    expect(parseRoleCell('Guru; Guru Piket, Wali Kelas')).toEqual({
      roles: ['TEACHER', 'DUTY_TEACHER', 'HOMEROOM'],
      unknownTokens: [],
    })
    expect(parseRoleCell('Admin/TU, Koordinator')).toEqual({
      roles: ['ADMIN', 'ACTIVITY_COORDINATOR'],
      unknownTokens: [],
    })
    expect(parseRoleCell('Guru, PeranAsing')).toEqual({
      roles: ['TEACHER'],
      unknownTokens: ['PeranAsing'],
    })
  })

  it('parseDelimitedText mendukung koma, titik koma Excel Indonesia, tab, dan tabel HTML (.xls)', () => {
    const semicolonCsv = 'username;nama_lengkap;nip;peran\r\nbudi;Budi Santoso;198801;Guru'
    expect(parseDelimitedText(semicolonCsv)).toEqual([
      ['username', 'nama_lengkap', 'nip', 'peran'],
      ['budi', 'Budi Santoso', '198801', 'Guru'],
    ])

    const tabTsv = 'username\tnama_lengkap\tnip\nbudi\tBudi Santoso\t198801'
    expect(parseDelimitedText(tabTsv)).toEqual([
      ['username', 'nama_lengkap', 'nip'],
      ['budi', 'Budi Santoso', '198801'],
    ])

    const excelHtml = buildBlankUserTemplateExcel()
    expect(excelHtml).toContain("mso-number-format:'\\@'")
    expect(excelHtml).toContain('<colgroup>')
    const parsedFromExcel = prepareBulkPreview(excelHtml, [], [], ['SUPER_ADMIN'])
    expect(parsedFromExcel).toHaveLength(3)
    expect(parsedFromExcel[0]).toMatchObject({
      valid: true,
      name: 'Budi Santoso, S.Pd.',
      nip: '198803152014021001',
      username: 'budi.santoso',
    })
  })

  it('prepareBulkPreview mendeteksi tautan guru, pembuatan guru baru, dan error duplikat (format lama & format baru)', () => {
    const existingUsers = [{ id: 'u1', username: 'sudah.ada', teacherId: 't_used' }]
    const existingTeachers = [
      { id: 't_used', nip: '11111', name: 'Guru Terpakai', status: 'ACTIVE' as const, userId: 'u1' },
      { id: 't_free', nip: '22222', name: 'Guru Bebas', status: 'ACTIVE' as const, userId: null },
    ]
    const csv = [
      'username,nama_lengkap,nip,peran,email,telepon,password',
      ',Guru Bebas,22222,Guru,,,',
      ',Guru Baru Sekali,33333,"Guru; Wali Kelas",guru.baru@sch.id,08123456789,',
      'sudah.ada,Duplikat Username,44444,Guru,,,',
    ].join('\n')

    const rows = prepareBulkPreview(csv, existingUsers, existingTeachers, ['SUPER_ADMIN'])
    expect(rows).toHaveLength(3)

    expect(rows[0]).toMatchObject({
      valid: true,
      username: 'guru.bebas',
      usernameAuto: true,
      teacherId: 't_free',
      teacherAction: 'LINKED_EXISTING',
    })
    expect(rows[1]).toMatchObject({
      valid: true,
      username: 'guru.baru',
      teacherId: null,
      teacherAction: 'CREATED_NEW',
      roles: ['TEACHER', 'HOMEROOM'],
    })
    expect(rows[2]?.valid).toBe(false)
    expect(rows[2]?.errors.join(' ')).toMatch(/sudah terdaftar/)
  })

  it('membangun template Excel (.xls) dan CSV untuk template kosong, guru belum berakun, dan kredensial', () => {
    const blankCsv = buildBlankUserTemplateCSV()
    expect(blankCsv.startsWith('\uFEFF')).toBe(true)
    expect(blankCsv).toContain('No,Nama Lengkap *,NIP,Peran,Email,No. Telepon,Username (Opsional),Kata Sandi Awal (Opsional)')

    const sampleTeachers = [
      { id: 't1', nip: '1990012020011001', name: 'Andi Wijaya, S.Pd.', phone: '08111222333', subjectIds: [], status: 'ACTIVE' as const, userId: null },
    ]
    const unlinkedCsv = buildUnlinkedTeachersTemplateCSV(sampleTeachers, [])
    expect(unlinkedCsv).toContain('andi.wijaya')
    expect(unlinkedCsv).toContain('1990012020011001')

    const unlinkedXls = buildUnlinkedTeachersTemplateExcel(sampleTeachers, [])
    expect(unlinkedXls).toContain('Andi Wijaya, S.Pd.')
    expect(unlinkedXls).toContain('1990012020011001')
    const previewFromUnlinkedXls = prepareBulkPreview(unlinkedXls, [], sampleTeachers, ['ADMIN'])
    expect(previewFromUnlinkedXls).toHaveLength(1)
    expect(previewFromUnlinkedXls[0]).toMatchObject({
      valid: true,
      username: 'andi.wijaya',
      teacherId: 't1',
      teacherAction: 'LINKED_EXISTING',
    })

    const sampleCreated = [
      {
        user: {
          id: 'u1',
          username: 'andi.wijaya',
          name: 'Andi Wijaya, S.Pd.',
          email: null,
          roles: ['TEACHER' as const],
          status: 'ACTIVE' as const,
          teacherId: 't1',
          teacherName: 'Andi Wijaya, S.Pd.',
          lastLoginAt: null,
          mustChangePassword: true,
          failedLogins7d: 0,
          createdAt: null,
          version: 1,
        },
        temporaryPassword: 'Ep-AbCdEf23',
        teacherAction: 'CREATED_NEW' as const,
      },
    ]
    const credsCsv = buildCredentialsCSV(sampleCreated)
    expect(credsCsv).toContain('Ep-AbCdEf23')
    expect(credsCsv).toContain('Master Guru baru dibuat otomatis')

    const credsXls = buildCredentialsExcel(sampleCreated)
    expect(credsXls).toContain('Ep-AbCdEf23')
    expect(credsXls).toContain("mso-number-format:'\\@'")
  })
})
