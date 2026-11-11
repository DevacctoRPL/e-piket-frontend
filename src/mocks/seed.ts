/**
 * Seed data representatif (PRD §10.8): kelas pagi/siang, siswa aktif/nonaktif, guru dengan jadwal,
 * guru yang absen, slot jam kosong, dan histori ±2 minggu agar laporan berisi data.
 * Deterministik (PRNG ber-seed) dan relatif terhadap "hari ini" zona sekolah saat seed dibuat.
 *
 * Catatan demo: jadwal di-seed untuk SEMUA hari (termasuk Minggu) agar demo selalu berisi data
 * kapan pun dijalankan. Histori melewati hari Minggu.
 */
import { addDays, combineDateTime, isoDayOfWeek, nowWallTime, todayISO, toISODateTime, wallTimeToMinutes } from '@/lib/date'
import { TEACHER_ABSENT_STATUSES } from '@/lib/enums'
import type {
  AcademicYear,
  AttendanceStatus,
  AuditLog,
  ClassRoom,
  DutyAbsentTeacherRow,
  DutyAgenda,
  DutyAssignment,
  ExtraActivity,
  ID,
  ISODate,
  ISODateTime,
  LoginEvent,
  Period,
  SchoolSettings,
  Shift,
  Student,
  StudentAttendanceRecord,
  StudentDismissal,
  Subject,
  SubstitutionRecord,
  Teacher,
  TeacherAttendance,
  TeacherAttendanceStatus,
  TeachingLog,
  TimetableSlot,
} from '@/types/entities'
import { MOCK_SCHEMA_VERSION, type MockDb, type MockUser, type StoredSession } from './db'

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIRST_M = ['Ahmad', 'Budi', 'Dimas', 'Fajar', 'Galih', 'Hendra', 'Irfan', 'Joko', 'Kevin', 'Lutfi', 'Rizky', 'Satria', 'Taufik', 'Wahyu', 'Yoga', 'Arif', 'Bayu', 'Dani', 'Eko', 'Gilang']
const FIRST_F = ['Ayu', 'Bunga', 'Citra', 'Dewi', 'Elsa', 'Fitri', 'Gita', 'Hana', 'Indah', 'Jihan', 'Kirana', 'Laras', 'Maya', 'Nadia', 'Putri', 'Rani', 'Salsa', 'Tiara', 'Wulan', 'Zahra']
const LAST = ['Pratama', 'Saputra', 'Wijaya', 'Hidayat', 'Nugroho', 'Lestari', 'Rahmawati', 'Kusuma', 'Santoso', 'Permata', 'Maulana', 'Ramadhan', 'Anggraini', 'Setiawan', 'Purnama', 'Utami', 'Firmansyah', 'Handayani', 'Syahputra', 'Wulandari']
const TEACHER_NAMES = [
  'Sri Wahyuni, S.Pd.', 'Agus Salim, S.Kom.', 'Rina Marlina, S.Pd.', 'Bambang Susilo, M.Pd.',
  'Dwi Astuti, S.Pd.', 'Heru Kurniawan, S.T.', 'Nur Aini, S.Pd.', 'Yusuf Hakim, S.Kom.',
  'Endang Sulastri, S.Pd.', 'Teguh Prasetyo, S.Pd.', 'Lilis Suryani, S.E.', 'Andi Firmansyah, S.Pd.',
  'Ratna Sari, S.Pd.', 'Dedi Kurnia, S.Kom.', 'Siti Fatimah, S.Ag.', 'Wawan Setiadi, S.Or.',
]
const SUBJECTS: [string, string][] = [
  ['MTK', 'Matematika'], ['BIN', 'Bahasa Indonesia'], ['BIG', 'Bahasa Inggris'], ['PKN', 'Pendidikan Pancasila'],
  ['PAI', 'Pendidikan Agama'], ['PJOK', 'PJOK'], ['INF', 'Informatika'], ['PRD', 'Produktif Kejuruan'],
  ['SJR', 'Sejarah'], ['IPAS', 'Projek IPAS'],
]

const ts = (date: ISODate, time: string) => combineDateTime(date, time)
const pad = (n: number, w = 2) => String(n).padStart(w, '0')

export function seed(): MockDb {
  const rand = mulberry32(20261108)
  const pickN = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)] as T
  const today = todayISO()
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  const ayStart = month >= 7 ? year : year - 1
  const ayId = 'ay_1'
  const sem1 = 'sem_1'
  const sem2 = 'sem_2'
  const sem1Active = month >= 7

  const academicYears: AcademicYear[] = [
    {
      id: ayId,
      name: `${ayStart}/${ayStart + 1}`,
      startDate: `${ayStart}-07-14`,
      endDate: `${ayStart + 1}-06-27`,
      isActive: true,
      semesters: [
        { id: sem1, academicYearId: ayId, number: 1, name: 'Ganjil', startDate: `${ayStart}-07-14`, endDate: `${ayStart}-12-19`, isActive: sem1Active },
        { id: sem2, academicYearId: ayId, number: 2, name: 'Genap', startDate: `${ayStart + 1}-01-05`, endDate: `${ayStart + 1}-06-27`, isActive: !sem1Active },
      ],
    },
    {
      id: 'ay_0',
      name: `${ayStart - 1}/${ayStart}`,
      startDate: `${ayStart - 1}-07-15`,
      endDate: `${ayStart}-06-28`,
      isActive: false,
      semesters: [
        { id: 'sem_01', academicYearId: 'ay_0', number: 1, name: 'Ganjil', startDate: `${ayStart - 1}-07-15`, endDate: `${ayStart - 1}-12-20`, isActive: false },
        { id: 'sem_02', academicYearId: 'ay_0', number: 2, name: 'Genap', startDate: `${ayStart}-01-06`, endDate: `${ayStart}-06-28`, isActive: false },
      ],
    },
  ]
  const activeSemId = sem1Active ? sem1 : sem2

  const shifts: Shift[] = [
    { id: 'sh_1', code: 'MORNING', name: 'Pagi', startTime: '07:00', endTime: '12:15', lateToleranceMinutes: 10, isActive: true },
    { id: 'sh_2', code: 'AFTERNOON', name: 'Siang', startTime: '12:30', endTime: '17:45', lateToleranceMinutes: 10, isActive: true },
  ]

  const periods: Period[] = []
  for (const sh of shifts) {
    let [h, m] = sh.startTime.split(':').map(Number) as [number, number]
    for (let n = 1; n <= 8; n++) {
      const start = `${pad(h)}:${pad(m)}`
      m += 40
      while (m >= 60) { m -= 60; h += 1 }
      periods.push({ id: `per_${sh.code}_${n}`, shiftCode: sh.code, number: n, startTime: start, endTime: `${pad(h)}:${pad(m)}`, durationMinutes: 40 })
      if (n === 4) { m += 15; while (m >= 60) { m -= 60; h += 1 } } // istirahat
    }
  }

  const subjects: Subject[] = SUBJECTS.map(([code, name], i) => ({ id: `sub_${i + 1}`, code, name }))

  const teachers: Teacher[] = TEACHER_NAMES.map((name, i) => ({
    id: `tch_${i + 1}`,
    nip: `19${70 + (i % 25)}${pad((i % 12) + 1)}${pad((i % 27) + 1)}20${pad(10 + i)}0${(i % 2) + 1}${pad(i + 1, 3)}`,
    name,
    phone: `0812${pad(Math.floor(rand() * 1e8), 8)}`,
    subjectIds: [`sub_${(i % 10) + 1}`, `sub_${((i + 3) % 10) + 1}`],
    status: 'ACTIVE',
    userId: null,
  }))

  const classDefs: [string, number, string, string][] = [
    ['X TKJ 1', 10, 'Teknik Komputer dan Jaringan', 'MORNING'],
    ['X AKL 1', 10, 'Akuntansi dan Keuangan Lembaga', 'MORNING'],
    ['XI TKJ 1', 11, 'Teknik Komputer dan Jaringan', 'MORNING'],
    ['XII TKJ 1', 12, 'Teknik Komputer dan Jaringan', 'MORNING'],
    ['X TKJ 2', 10, 'Teknik Komputer dan Jaringan', 'AFTERNOON'],
    ['X MPLB 1', 10, 'Manajemen Perkantoran dan Layanan Bisnis', 'AFTERNOON'],
    ['XI AKL 1', 11, 'Akuntansi dan Keuangan Lembaga', 'AFTERNOON'],
    ['XI MPLB 1', 11, 'Manajemen Perkantoran dan Layanan Bisnis', 'AFTERNOON'],
  ]
  // wali kelas: tch_3 → kelas 1 (akun walikelas), sisanya bergilir
  const homeroomOrder = ['tch_3', 'tch_5', 'tch_7', 'tch_9', 'tch_11', 'tch_13', 'tch_15', 'tch_16']
  const classes: Omit<ClassRoom, 'studentCount'>[] = classDefs.map(([name, grade, program, shiftCode], i) => ({
    id: `cls_${i + 1}`,
    name,
    grade,
    program,
    shiftCode,
    homeroomTeacherId: homeroomOrder[i] ?? null,
    academicYearId: ayId,
    status: 'ACTIVE',
  }))

  const students: Student[] = []
  let nis = 2400
  classes.forEach((c, ci) => {
    for (let k = 0; k < 24; k++) {
      const female = rand() < 0.5
      const name = `${pickN(female ? FIRST_F : FIRST_M)} ${pickN(LAST)}`
      nis += 1
      const inactive = k === 23 && ci % 3 === 0
      students.push({
        id: `std_${pad(ci + 1)}${pad(k + 1)}`,
        nis: `${ayStart % 100}${pad(c.grade)}${nis}`,
        name,
        gender: female ? 'P' : 'L',
        classId: c.id,
        status: inactive ? 'INACTIVE' : 'ACTIVE',
        inactiveFrom: inactive ? addDays(today, -20) : null,
        guardianName: `${pickN(FIRST_M)} ${name.split(' ')[1]}`,
        guardianPhone: `08${pickN(['12', '13', '21', '52', '57', '77', '96'])}${pad(Math.floor(rand() * 1e8), 8)}`,
      })
    }
  })

  /* jadwal: 4 slot × 2 jam per kelas per hari, guru bebas bentrok */
  const timetable: TimetableSlot[] = []
  for (let dow = 1; dow <= 7; dow++) {
    ;(['MORNING', 'AFTERNOON'] as const).forEach((shiftCode, si) => {
      const shiftClasses = classes.filter((c) => c.shiftCode === shiftCode)
      shiftClasses.forEach((c, cIdx) => {
        for (let k = 0; k < 4; k++) {
          // cIdx*2 + k menutup 0..9 → kedelapan guru shift mengajar setiap hari (termasuk Senin); tetap bebas bentrok per jam
          const tIdx = si * 8 + ((cIdx * 2 + k + dow) % 8)
          const teacher = teachers[tIdx] as Teacher
          timetable.push({
            id: `tt_${dow}_${c.id}_${k + 1}`,
            academicYearId: ayId,
            semesterId: activeSemId,
            dayOfWeek: dow,
            shiftCode,
            classId: c.id,
            teacherId: teacher.id,
            subjectId: teacher.subjectIds[(dow + k) % 2] as ID,
            periodStart: k * 2 + 1,
            periodEnd: k * 2 + 2,
            periodCount: 2,
          })
        }
      })
    })
  }

  const users: MockUser[] = [
    { id: 'usr_admin', username: 'admin', password: 'password', name: 'Yulia Rahman (TU)', email: 'tu@sekolah.example.id', roles: ['ADMIN'], teacherId: null, status: 'ACTIVE' },
    { id: 'usr_kepsek', username: 'kepsek', password: 'password', name: 'Drs. Hartono, M.Pd.', email: 'kepsek@sekolah.example.id', roles: ['PRINCIPAL'], teacherId: null, status: 'ACTIVE' },
    { id: 'usr_guru', username: 'guru', password: 'password', name: teachers[0]!.name, email: null, roles: ['TEACHER'], teacherId: 'tch_1', status: 'ACTIVE' },
    { id: 'usr_piket', username: 'piket', password: 'password', name: teachers[1]!.name, email: null, roles: ['TEACHER', 'DUTY_TEACHER'], teacherId: 'tch_2', status: 'ACTIVE' },
    { id: 'usr_walikelas', username: 'walikelas', password: 'password', name: teachers[2]!.name, email: null, roles: ['TEACHER', 'HOMEROOM'], teacherId: 'tch_3', status: 'ACTIVE' },
    { id: 'usr_koordinator', username: 'koordinator', password: 'password', name: teachers[9]!.name, email: null, roles: ['TEACHER', 'ACTIVITY_COORDINATOR'], teacherId: 'tch_10', status: 'ACTIVE' },
    // Ditambahkan di AKHIR: indeks users[0..5] dipakai kode seed lain.
    { id: 'usr_superadmin', username: 'superadmin', password: 'password', name: 'Dimas Prasetyo (Super Admin)', email: 'it@sekolah.example.id', roles: ['SUPER_ADMIN'], teacherId: null, status: 'ACTIVE' },
    { id: 'usr_tu_lama', username: 'tu.lama', password: 'password', name: 'Siti Aminah (TU)', email: null, roles: ['ADMIN'], teacherId: null, status: 'INACTIVE' },
  ]
  for (const u of users) {
    const t = teachers.find((x) => x.id === u.teacherId)
    if (t) t.userId = u.id
  }
  const userName = (id: ID) => users.find((u) => u.id === id)?.name ?? 'Sistem'

  /* piket: rutin per hari. tch_2 (akun piket) piket pagi setiap hari agar demo selalu bisa diakses */
  const dutyAssignments: DutyAssignment[] = []
  for (let dow = 1; dow <= 7; dow++) {
    dutyAssignments.push({ id: `duty_${dow}_M`, dayOfWeek: dow, date: null, shiftCode: 'MORNING', teacherIds: ['tch_2', `tch_${((dow + 3) % 6) + 3}`], note: null })
    dutyAssignments.push({ id: `duty_${dow}_A`, dayOfWeek: dow, date: null, shiftCode: 'AFTERNOON', teacherIds: ['tch_2', `tch_${((dow + 1) % 6) + 10}`], note: null })
  }

  const slotsFor = (date: ISODate) => timetable.filter((s) => s.dayOfWeek === isoDayOfWeek(date))
  const shiftOfTeacher = (tid: ID) => (Number(tid.split('_')[1]) <= 8 ? 'MORNING' : 'AFTERNOON')
  const periodStartTime = (shiftCode: string, n: number) => periods.find((p) => p.shiftCode === shiftCode && p.number === n)?.startTime ?? '07:00'

  const studentSessions: StoredSession[] = []
  const studentRecords: StudentAttendanceRecord[] = []
  const teacherAttendance: TeacherAttendance[] = []
  const substitutions: SubstitutionRecord[] = []
  const teachingLogs: TeachingLog[] = []
  const dismissals: StudentDismissal[] = []
  const dutyAgendas: DutyAgenda[] = []
  const auditLogs: AuditLog[] = []

  const REASONS: Partial<Record<AttendanceStatus, string[]>> = {
    SICK: ['Demam', 'Flu', 'Sakit perut', 'Kontrol ke dokter'],
    PERMISSION: ['Keperluan keluarga', 'Acara keluarga', 'Mengurus dokumen'],
    ABSENT: ['Tanpa keterangan'],
    LATE: ['Ban bocor', 'Hujan deras', 'Bangun kesiangan'],
  }
  const TEACHER_REASONS: Partial<Record<TeacherAttendanceStatus, string[]>> = {
    SICK: ['Demam', 'Kontrol kesehatan'],
    PERMISSION: ['Keperluan keluarga', 'Mengantar orang tua berobat'],
    OFFICIAL_DUTY: ['Workshop kurikulum di dinas', 'Pendampingan lomba siswa'],
    ABSENT: ['Tanpa keterangan'],
  }

  function pickStudentStatus(): AttendanceStatus {
    const r = rand()
    if (r < 0.9) return 'PRESENT'
    if (r < 0.93) return 'SICK'
    if (r < 0.955) return 'PERMISSION'
    if (r < 0.975) return 'ABSENT'
    if (r < 0.995) return 'LATE'
    return 'EXCUSED'
  }

  const historyDates: ISODate[] = []
  for (let i = 14; i >= 1; i--) {
    const d = addDays(today, -i)
    if (isoDayOfWeek(d) !== 7) historyDates.push(d)
  }

  /* -------------------------------------------------- per hari: absensi siswa (sesi harian) */
  const makeSession = (date: ISODate, c: (typeof classes)[number], status: StoredSession['status'], creator: MockUser, coverage = 1) => {
    const sessionId = `ses_${date.replaceAll('-', '')}_${c.id}_1`
    const createdAt = ts(date, c.shiftCode === 'MORNING' ? '07:10' : '12:40')
    studentSessions.push({
      id: sessionId,
      date,
      shiftCode: c.shiftCode,
      classId: c.id,
      sessionNumber: 1,
      sessionLabel: 'Harian',
      status,
      createdBy: creator.id,
      createdByName: creator.name,
      createdAt,
      submittedAt: status === 'FINAL' || status === 'SUBMITTED' ? ts(date, c.shiftCode === 'MORNING' ? '07:25' : '12:55') : null,
      submittedBy: status === 'FINAL' || status === 'SUBMITTED' ? creator.id : null,
      submittedByName: status === 'FINAL' || status === 'SUBMITTED' ? creator.name : null,
      version: 1,
    })
    const roster = students.filter((s) => s.classId === c.id && (s.status === 'ACTIVE' || (s.inactiveFrom && date < s.inactiveFrom)))
    for (const s of roster) {
      if (rand() > coverage) continue
      const status = pickStudentStatus()
      const reasons = REASONS[status]
      const contacted = status !== 'PRESENT' && status !== 'LATE' && rand() < 0.6
      studentRecords.push({
        id: `rec_${sessionId.slice(4)}_${s.id.slice(4)}`,
        sessionId,
        studentId: s.id,
        studentName: s.name,
        studentNis: s.nis,
        status,
        arrivalTime: status === 'LATE' ? `0${7 + Math.floor(rand() * 1)}:${pad(15 + Math.floor(rand() * 40))}` : null,
        reason: reasons ? pickN(reasons) : null,
        note: null,
        contact: contacted
          ? {
              contactedPhone: s.guardianPhone,
              receiverName: pickN(['Ayah', 'Ibu', 'Kakak', 'Wali']),
              contactNote: pickN(['Dikonfirmasi via telepon', 'Orang tua sudah mengetahui', 'Surat menyusul']),
              contactedAt: ts(date, '08:15'),
              contactedBy: creator.id,
              contactedByName: creator.name,
            }
          : null,
        updatedAt: createdAt,
        updatedBy: creator.id,
        updatedByName: creator.name,
        version: 1,
      })
    }
  }
  const piketUser = users[3] as MockUser
  const waliUser = users[4] as MockUser
  const guruUser = users[2] as MockUser
  for (const d of historyDates) for (const c of classes) makeSession(d, c, 'FINAL', c.id === 'cls_1' ? waliUser : piketUser)
  // hari ini: 2 kelas final, 1 draft (sebagian terisi), sisanya belum dibuat
  makeSession(today, classes[1]!, 'FINAL', piketUser)
  makeSession(today, classes[2]!, 'SUBMITTED', guruUser)
  makeSession(today, classes[4]!, 'DRAFT', piketUser, 0.5)

  /* -------------------------------------------------- absensi guru + jam kosong + jurnal */
  const absentPlan = new Map<string, TeacherAttendanceStatus>() // `${date}|${tid}`
  for (const d of historyDates) {
    for (const t of teachers) {
      const r = rand()
      if (r < 0.04) absentPlan.set(`${d}|${t.id}`, 'SICK')
      else if (r < 0.065) absentPlan.set(`${d}|${t.id}`, 'PERMISSION')
      else if (r < 0.075) absentPlan.set(`${d}|${t.id}`, 'OFFICIAL_DUTY')
      else if (r < 0.08) absentPlan.set(`${d}|${t.id}`, 'ABSENT')
      else if (r < 0.13) absentPlan.set(`${d}|${t.id}`, 'LATE')
    }
  }
  // hari ini: 2 guru pagi berhalangan (PRD §10.8)
  absentPlan.set(`${today}|tch_4`, 'SICK')
  absentPlan.set(`${today}|tch_6`, 'PERMISSION')
  absentPlan.set(`${today}|tch_12`, 'OFFICIAL_DUTY')

  const allDates = [...historyDates, today]
  for (const d of allDates) {
    const daySlots = slotsFor(d)
    for (const t of teachers) {
      const tSlots = daySlots.filter((s) => s.teacherId === t.id)
      if (tSlots.length === 0) continue
      const shiftCode = shiftOfTeacher(t.id)
      const shift = shifts.find((s) => s.code === shiftCode) as Shift
      const planned = absentPlan.get(`${d}|${t.id}`) ?? 'PRESENT'
      const isToday = d === today
      // hari ini: akun guru (tch_1) belum check-in agar bisa dicoba; sebagian guru siang belum datang
      if (isToday && (t.id === 'tch_1' || (shiftCode === 'AFTERNOON' && planned === 'PRESENT' && rand() < 0.6))) continue
      const scheduled = tSlots.reduce((n, s) => n + s.periodCount, 0)
      const absent = TEACHER_ABSENT_STATUSES.includes(planned)
      const [sh, sm] = shift.startTime.split(':').map(Number) as [number, number]
      const arriveOffset = planned === 'LATE' ? 12 + Math.floor(rand() * 25) : -20 + Math.floor(rand() * 25)
      const arriveMin = sh * 60 + sm + arriveOffset
      const checkIn = absent ? null : ts(d, `${pad(Math.floor(arriveMin / 60))}:${pad(arriveMin % 60)}`)
      const [eh, em] = shift.endTime.split(':').map(Number) as [number, number]
      const checkOut = absent || isToday ? null : ts(d, `${pad(eh)}:${pad(em + Math.floor(rand() * 15))}`)
      const reasons = TEACHER_REASONS[planned]
      teacherAttendance.push({
        id: `tatt_${d.replaceAll('-', '')}_${t.id}`,
        teacherId: t.id,
        teacherName: t.name,
        date: d,
        shiftCode,
        checkInAt: checkIn,
        checkOutAt: checkOut,
        status: planned,
        reason: reasons ? pickN(reasons) : planned === 'LATE' ? 'Macet di jalan' : null,
        affectedPeriodsComputed: absent ? scheduled : 0,
        affectedPeriodsOverride: null,
        overrideReason: null,
        affectedPeriods: absent ? scheduled : 0,
        lateMinutes: planned === 'LATE' ? Math.max(0, arriveOffset - shift.lateToleranceMinutes) : null,
        source: absent ? 'DUTY' : 'SELF',
        updatedAt: checkIn ?? ts(d, '07:05'),
        updatedByName: absent ? piketUser.name : t.name,
        version: 1,
      })
    }

    // jam kosong: slot guru absen; histori 75% tertangani, hari ini hanya 1 slot tertangani
    const busyAt = (tid: ID, shiftCode: string, ps: number) =>
      daySlots.some((s) => s.teacherId === tid && s.shiftCode === shiftCode && s.periodStart === ps) ||
      substitutions.some((r) => r.date === d && r.substituteTeacherId === tid && r.shiftCode === shiftCode && r.periodStart === ps)
    let todayHandled = 0
    for (const s of daySlots) {
      const st = absentPlan.get(`${d}|${s.teacherId}`)
      if (!st || !TEACHER_ABSENT_STATUSES.includes(st)) continue
      const handle = d === today ? todayHandled++ < 1 : rand() < 0.75
      if (!handle) continue
      const candidate = teachers.find(
        (t) =>
          t.id !== s.teacherId &&
          shiftOfTeacher(t.id) === s.shiftCode &&
          !TEACHER_ABSENT_STATUSES.includes(absentPlan.get(`${d}|${t.id}`) ?? 'PRESENT') &&
          !busyAt(t.id, s.shiftCode, s.periodStart),
      )
      if (!candidate) continue
      substitutions.push({
        id: `subr_${d.replaceAll('-', '')}_${s.id}`,
        date: d,
        shiftCode: s.shiftCode,
        timetableSlotId: s.id,
        classId: s.classId,
        subjectId: s.subjectId,
        absentTeacherId: s.teacherId,
        substituteTeacherId: candidate.id,
        substituteTeacherName: candidate.name,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        periodCount: s.periodCount,
        activity: pickN(['Mengerjakan tugas dari guru mapel', 'Latihan soal', 'Diskusi kelompok', 'Membaca materi bab berikutnya']),
        note: null,
        status: 'ACTIVE',
        conflictOverridden: false,
        overrideReason: null,
        teachingLogId: null,
        createdByName: piketUser.name,
        createdAt: ts(d, '07:30'),
      })
    }

    // jurnal mengajar: histori ±85% terisi; hari ini kosong (diisi pengguna)
    if (d !== today) {
      for (const s of daySlots) {
        if (TEACHER_ABSENT_STATUSES.includes(absentPlan.get(`${d}|${s.teacherId}`) ?? 'PRESENT')) continue
        if (rand() > 0.85) continue
        const t = teachers.find((x) => x.id === s.teacherId) as Teacher
        const c = classes.find((x) => x.id === s.classId)!
        const subj = subjects.find((x) => x.id === s.subjectId)!
        const notHeld = rand() < 0.03
        teachingLogs.push({
          id: `tlog_${d.replaceAll('-', '')}_${s.id}`,
          date: d,
          shiftCode: s.shiftCode,
          timetableSlotId: s.id,
          teacherId: t.id,
          teacherName: t.name,
          classId: c.id,
          className: c.name,
          subjectId: subj.id,
          subjectName: subj.name,
          periodStart: s.periodStart,
          periodEnd: s.periodEnd,
          periodCount: s.periodCount,
          periodCountOverrideReason: null,
          meetingNumber: 8 + Math.floor((historyDates.indexOf(d) + 1) / 6),
          topic: notHeld ? null : `${subj.name}: ${pickN(['Pengantar materi', 'Latihan soal', 'Praktikum', 'Diskusi studi kasus', 'Ulangan harian', 'Presentasi kelompok'])}`,
          activity: notHeld ? null : pickN(['Ceramah dan tanya jawab', 'Praktik di lab', 'Kerja kelompok', 'Penugasan individu']),
          note: null,
          teacherPresence: 'PRESENT',
          execution: notHeld ? 'NOT_HELD' : 'HELD',
          notHeldReason: notHeld ? 'Kelas mengikuti kegiatan upacara/acara sekolah' : null,
          studentSick: Math.floor(rand() * 2),
          studentPermission: Math.floor(rand() * 2),
          studentAbsent: rand() < 0.2 ? 1 : 0,
          substitutionRecordId: null,
          status: 'FINAL',
          submittedAt: ts(d, periodStartTime(s.shiftCode, s.periodEnd)),
          approvedAt: null,
          approvedByName: null,
          createdAt: ts(d, periodStartTime(s.shiftCode, s.periodEnd)),
          updatedAt: ts(d, periodStartTime(s.shiftCode, s.periodEnd)),
          version: 1,
        })
      }
    }

    // agenda piket histori: FINAL dengan snapshot
    if (d !== today) {
      for (const sh of shifts) {
        const assign = dutyAssignments.find((a) => a.dayOfWeek === isoDayOfWeek(d) && a.shiftCode === sh.code)!
        const scheduledIds = [...new Set(daySlots.filter((s) => s.shiftCode === sh.code).map((s) => s.teacherId))]
        const absentRows: DutyAbsentTeacherRow[] = teacherAttendance
          .filter((a) => a.date === d && scheduledIds.includes(a.teacherId) && TEACHER_ABSENT_STATUSES.includes(a.status))
          .map((a) => ({
            teacherId: a.teacherId,
            teacherName: a.teacherName,
            status: a.status,
            reason: a.reason,
            affectedPeriods: a.affectedPeriods,
            handledPeriods: substitutions.filter((r) => r.date === d && r.absentTeacherId === a.teacherId).reduce((n, r) => n + r.periodCount, 0),
          }))
        const dutyNames = assign.teacherIds.map((id) => teachers.find((t) => t.id === id)?.name ?? '')
        const hasNote = rand() < 0.6
        dutyAgendas.push({
          id: `dag_${d.replaceAll('-', '')}_${sh.code}`,
          date: d,
          shiftCode: sh.code,
          dutyTeacherIds: assign.teacherIds,
          dutyTeacherNames: dutyNames,
          status: 'FINAL',
          scheduledTeacherCount: scheduledIds.length,
          presentTeacherCount: scheduledIds.length - absentRows.length,
          absentTeachers: absentRows,
          noAbsentTeachers: absentRows.length === 0,
          notes: hasNote
            ? [{
                id: `dn_${d}_${sh.code}`,
                time: ts(d, sh.code === 'MORNING' ? '09:20' : '14:10'),
                category: pickN(['Kejadian', 'Tamu', 'Kedisiplinan']),
                content: pickN([
                  'Kunjungan orang tua siswa kelas X untuk konsultasi dengan wali kelas.',
                  'Pemeriksaan kerapian seragam di gerbang; 5 siswa diberi pembinaan.',
                  'Listrik padam ±30 menit di lab komputer, pembelajaran dialihkan ke teori.',
                  'Siswa sakit diantar ke UKS dan dijemput orang tua.',
                ]),
                createdBy: piketUser.id,
                createdByName: piketUser.name,
              }]
            : [],
          noImportantNotes: !hasNote,
          substitutionSummary: null,
          createdBy: piketUser.id,
          createdAt: ts(d, sh.code === 'MORNING' ? '06:50' : '12:20'),
          submittedAt: ts(d, sh.code === 'MORNING' ? '12:10' : '17:40'),
          submittedByName: piketUser.name,
          finalizedAt: ts(d, sh.code === 'MORNING' ? '12:15' : '17:45'),
          finalizedByName: piketUser.name,
          version: 2,
        })
      }
    }
  }

  /* -------------------------------------------------- kepulangan */
  for (const d of allDates) {
    const n = d === today ? 3 : 1 + Math.floor(rand() * 3)
    for (let i = 0; i < n; i++) {
      const s = pickN(students.filter((x) => x.status === 'ACTIVE'))
      const c = classes.find((x) => x.id === s.classId)!
      const type = pickN(['EARLY_LEAVE', 'EARLY_LEAVE', 'TEMPORARY_EXIT', 'NORMAL'] as const)
      const base = c.shiftCode === 'MORNING' ? 9 : 14
      const exit = ts(d, `${pad(base + Math.floor(rand() * 3))}:${pad(Math.floor(rand() * 60))}`)
      dismissals.push({
        id: `dis_${d.replaceAll('-', '')}_${i}`,
        studentId: s.id,
        studentName: s.name,
        studentNis: s.nis,
        classId: c.id,
        className: c.name,
        date: d,
        shiftCode: c.shiftCode,
        exitTime: exit,
        returnTime: type === 'TEMPORARY_EXIT' ? ts(d, `${pad(base + 3)}:15`) : null,
        type,
        pickupName: type === 'TEMPORARY_EXIT' ? null : s.guardianName,
        pickupRelation: type === 'TEMPORARY_EXIT' ? null : pickN(['Ayah', 'Ibu', 'Kakak']),
        note: type === 'EARLY_LEAVE' ? pickN(['Sakit, dijemput orang tua', 'Keperluan keluarga']) : type === 'TEMPORARY_EXIT' ? 'Fotokopi berkas' : null,
        recordedBy: piketUser.id,
        recordedByName: piketUser.name,
        recordedAt: exit,
      })
    }
  }

  /* -------------------------------------------------- kegiatan tambahan */
  const extraActivities: ExtraActivity[] = [
    {
      id: 'ext_1', name: 'Kursus Persiapan Sertifikasi Jaringan', type: 'COURSE', instructorTeacherId: 'tch_8', instructorName: teachers[7]!.name,
      coordinatorUserId: 'usr_koordinator', date: addDays(today, -2), shiftCode: 'AFTERNOON', startTime: '13:00', endTime: '15:00',
      classIds: ['cls_3', 'cls_4'], classNames: ['XI TKJ 1', 'XII TKJ 1'], topic: 'Konfigurasi VLAN dan routing dasar', note: 'Membawa laptop masing-masing',
      participantAttendanceEnabled: false, participants: [], status: 'FINAL', createdAt: ts(addDays(today, -3), '10:00'), version: 1,
    },
    {
      id: 'ext_2', name: 'Jam Tambahan Matematika Kelas XII', type: 'EXTRA_HOURS', instructorTeacherId: 'tch_1', instructorName: teachers[0]!.name,
      coordinatorUserId: 'usr_koordinator', date: today, shiftCode: 'AFTERNOON', startTime: '13:00', endTime: '14:30',
      classIds: ['cls_4'], classNames: ['XII TKJ 1'], topic: 'Latihan soal persiapan asesmen', note: null,
      participantAttendanceEnabled: true,
      participants: students.filter((s) => s.classId === 'cls_4' && s.status === 'ACTIVE').slice(0, 10).map((s) => ({ studentId: s.id, studentName: s.name, classId: s.classId, status: 'PRESENT' as const })),
      status: 'DRAFT', createdAt: ts(addDays(today, -1), '09:00'), version: 1,
    },
    {
      id: 'ext_3', name: 'Pembinaan Lomba Akuntansi', type: 'OTHER', instructorTeacherId: 'tch_11', instructorName: teachers[10]!.name,
      coordinatorUserId: 'usr_koordinator', date: addDays(today, 2), shiftCode: 'MORNING', startTime: '13:00', endTime: '15:00',
      classIds: ['cls_2', 'cls_7'], classNames: ['X AKL 1', 'XI AKL 1'], topic: 'Simulasi soal lomba tingkat kota', note: null,
      participantAttendanceEnabled: false, participants: [], status: 'DRAFT', createdAt: ts(addDays(today, -1), '11:00'), version: 1,
    },
  ]

  /* -------------------------------------------------- audit awal */
  auditLogs.push({
    id: 'aud_seed_1', timestamp: ts(addDays(today, -3), '09:12'), actorId: 'usr_admin', actorName: userName('usr_admin'), action: 'CORRECT',
    entity: 'StudentAttendanceRecord', entityId: studentRecords[5]?.id ?? 'rec', summary: 'Koreksi status absensi siswa dari Alpa menjadi Sakit',
    before: { status: 'ABSENT', reason: 'Tanpa keterangan' }, after: { status: 'SICK', reason: 'Surat dokter menyusul' }, reason: 'Orang tua mengirim surat keterangan dokter', requestId: 'req_seed01',
  })
  auditLogs.push({
    id: 'aud_seed_2', timestamp: ts(addDays(today, -1), '12:15'), actorId: piketUser.id, actorName: piketUser.name, action: 'FINALIZE',
    entity: 'DutyAgenda', entityId: dutyAgendas.at(-2)?.id ?? 'dag', summary: 'Finalisasi agenda piket shift Pagi', before: { status: 'SUBMITTED' }, after: { status: 'FINAL' }, reason: null, requestId: 'req_seed02',
  })

  /* -------------------------------------------------- akun: audit contoh Super Admin */
  const sa = users.find((u) => u.id === 'usr_superadmin') as MockUser
  auditLogs.push(
    {
      id: 'aud_seed_3', timestamp: ts(addDays(today, -6), '08:05'), actorId: sa.id, actorName: sa.name, action: 'ROLE_CHANGE',
      entity: 'User', entityId: piketUser.id, summary: `Mengubah peran akun ${piketUser.name}`,
      before: { roles: ['TEACHER'] }, after: { roles: ['TEACHER', 'DUTY_TEACHER'] }, reason: null, requestId: 'req_seed03',
    },
    {
      id: 'aud_seed_4', timestamp: ts(addDays(today, -5), '10:20'), actorId: sa.id, actorName: sa.name, action: 'PASSWORD_RESET',
      entity: 'User', entityId: guruUser.id, summary: `Me-reset kata sandi akun ${guruUser.name}`,
      before: null, after: { mustChangePassword: true }, reason: 'Pengguna lupa kata sandi', requestId: 'req_seed04',
    },
    {
      id: 'aud_seed_5', timestamp: ts(addDays(today, -4), '13:40'), actorId: sa.id, actorName: sa.name, action: 'STATUS_CHANGE',
      entity: 'User', entityId: 'usr_tu_lama', summary: 'Menonaktifkan akun Siti Aminah (TU)',
      before: { status: 'ACTIVE' }, after: { status: 'INACTIVE' }, reason: 'Pindah tugas ke sekolah lain', requestId: 'req_seed05',
    },
    {
      id: 'aud_seed_6', timestamp: ts(addDays(today, -2), '09:30'), actorId: sa.id, actorName: sa.name, action: 'UPDATE',
      entity: 'SchoolSettings', entityId: 'settings', summary: 'Mengubah pengaturan sekolah: kategori catatan piket',
      before: { dutyNoteCategories: ['Kejadian', 'Tamu', 'Kedisiplinan', 'Lainnya'] },
      after: { dutyNoteCategories: ['Kejadian', 'Tamu', 'Kedisiplinan', 'Fasilitas', 'Lainnya'] }, reason: null, requestId: 'req_seed06',
    },
  )

  const loginEvents = seedAccountHistory(users, today)

  const settings: SchoolSettings = {
    schoolName: 'SMK Negeri Contoh 1',
    schoolAddress: 'Jl. Pendidikan No. 1, Kota Contoh',
    letterheadLines: ['PEMERINTAH PROVINSI CONTOH', 'DINAS PENDIDIKAN', 'SMK NEGERI CONTOH 1', 'Jl. Pendidikan No. 1, Kota Contoh · Telp. (021) 000000'],
    principalName: users[1]!.name,
    principalNip: '196805121994031005',
    city: 'Kota Contoh',
    timezone: 'Asia/Jakarta',
    schoolDays: [1, 2, 3, 4, 5, 6],
    attendanceStatuses: [
      { code: 'PRESENT', label: 'Hadir', shortCode: 'H', requiresReason: false, active: true },
      { code: 'SICK', label: 'Sakit', shortCode: 'S', requiresReason: true, active: true },
      { code: 'PERMISSION', label: 'Izin', shortCode: 'I', requiresReason: true, active: true },
      { code: 'ABSENT', label: 'Alpa', shortCode: 'A', requiresReason: true, active: true },
      { code: 'LATE', label: 'Terlambat', shortCode: 'T', requiresReason: false, active: true },
      { code: 'LEFT_EARLY', label: 'Pulang Lebih Awal', shortCode: 'PA', requiresReason: true, active: true },
      { code: 'EXCUSED', label: 'Dispensasi', shortCode: 'D', requiresReason: true, active: true },
    ],
    teacherReasonRequiredStatuses: ['SICK', 'PERMISSION', 'ABSENT', 'OFFICIAL_DUTY'],
    dismissalRequiresPickup: true,
    dutyNoteCategories: ['Kejadian', 'Tamu', 'Kedisiplinan', 'Fasilitas', 'Lainnya'],
    version: 1,
  }

  return {
    schemaVersion: MOCK_SCHEMA_VERSION,
    seedDate: today,
    users,
    academicYears,
    shifts,
    periods,
    classes,
    students,
    subjects,
    teachers,
    timetable,
    studentSessions,
    studentRecords,
    dismissals,
    teacherAttendance,
    dutyAssignments,
    dutyAgendas,
    teachingLogs,
    substitutions,
    extraActivities,
    auditLogs,
    loginEvents,
    settings,
    deleted: {},
    idempotency: {},
    tokens: {},
  }
}

/**
 * Riwayat login 7 hari + lastLoginAt/createdAt tiap akun. Memakai PRNG TERPISAH agar urutan angka acak
 * seed utama (siswa, absensi, dsb.) tidak bergeser. Kejadian hari ini selalu sebelum "sekarang".
 * Kata sandi tidak pernah dicatat.
 */
function seedAccountHistory(users: MockUser[], today: ISODate): LoginEvent[] {
  const rand = mulberry32(7331)
  const nowMs = Date.now()
  const minutesToday = wallTimeToMinutes(nowWallTime())
  const events: LoginEvent[] = []
  let seq = 0
  /** Waktu acak pada hari `offset` (0 = hari ini, sebelum sekarang). */
  const timeOn = (offset: number): ISODateTime => {
    if (offset === 0) {
      const maxBack = Math.max(1, minutesToday - 1)
      const back = 1 + Math.floor(rand() * Math.min(maxBack, 600))
      return toISODateTime(new Date(nowMs - Math.min(back, maxBack) * 60_000 - 1_000))
    }
    const minute = 6 * 60 + Math.floor(rand() * 10 * 60) // 06:00–15:59
    return combineDateTime(addDays(today, -offset), `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`)
  }
  const push = (e: Omit<LoginEvent, 'id'>) => {
    seq += 1
    events.push({ id: `lgn_seed_${pad(seq, 3)}`, ...e })
  }

  for (const u of users) {
    u.version = 1
    u.mustChangePassword = false
    u.createdAt = combineDateTime(addDays(today, -(60 + Math.floor(rand() * 60))), '08:00')
    u.updatedAt = u.createdAt
    if (u.status !== 'ACTIVE') continue
    for (let offset = 6; offset >= 0; offset--) {
      if (rand() < 0.12) {
        push({ timestamp: timeOn(offset), userId: u.id, username: u.username, success: false, reason: 'BAD_CREDENTIALS' })
      }
      if (rand() < 0.78) {
        push({ timestamp: timeOn(offset), userId: u.id, username: u.username, success: true, reason: 'OK' })
      }
    }
  }
  const superAdmin = users.find((u) => u.id === 'usr_superadmin')
  if (superAdmin) superAdmin.createdAt = combineDateTime(addDays(today, -150), '07:30')

  // Akun nonaktif mencoba masuk 2 hari lalu (ditolak).
  const tuLama = users.find((u) => u.id === 'usr_tu_lama')
  if (tuLama) {
    tuLama.lastLoginAt = combineDateTime(addDays(today, -9), '14:05')
    tuLama.updatedAt = combineDateTime(addDays(today, -4), '13:40')
    push({ timestamp: timeOn(2), userId: tuLama.id, username: tuLama.username, success: false, reason: 'INACTIVE' })
  }
  // 3× percobaan dengan username tak dikenal hari ini (contoh "percobaan gagal berulang").
  for (let i = 0; i < 3; i++) {
    push({ timestamp: timeOn(0), userId: null, username: 'administrator', success: false, reason: 'BAD_CREDENTIALS' })
  }

  events.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  for (const u of users) {
    const last = events.find((e) => e.userId === u.id && e.success)
    if (last) u.lastLoginAt = last.timestamp
    else u.lastLoginAt ??= null
  }
  return events
}
