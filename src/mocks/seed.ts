/**
 * Seed data representatif untuk 5 panel operasional Guru Piket:
 * Dashboard, Absensi Guru & Jam Kosong, Agenda Guru, Siswa Tidak Hadir (S/I/A/D/P), dan Jam Tambahan.
 */
import {
  addDays,
  combineDateTime,
  isoDayOfWeek,
  nowWallTime,
  todayISO,
  toISODateTime,
  wallTimeToMinutes,
} from '@/lib/date'
import { TEACHER_ABSENT_STATUSES } from '@/lib/enums'
import type {
  AcademicYear,
  AttendanceStatus,
  AuditLog,
  ClassRoom,
  DutyAssignment,
  ExtraActivity,
  ID,
  ISODate,
  ISODateTime,
  LoginEvent,
  ManualEmptySlot,
  Period,
  SchoolSettings,
  Shift,
  Student,
  StudentAttendanceRecord,
  Subject,
  SubstitutionRecord,
  Teacher,
  TeacherAttendance,
  TeacherAttendanceStatus,
  TeachingLog,
  TimetableSlot,
} from '@/types/entities'
import { MOCK_SCHEMA_VERSION, type MockDb, type MockUser, type StoredSession } from './db'
import { extractSmkPelitaNusantaraTeachers } from './smk-pelita-nusantara-schedule'

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

const FIRST_M = [
  'Ahmad', 'Budi', 'Dimas', 'Fajar', 'Galih', 'Hendra', 'Irfan', 'Joko', 'Kevin', 'Lutfi',
  'Rizky', 'Satria', 'Taufik', 'Wahyu', 'Yoga', 'Arif', 'Bayu', 'Dani', 'Eko', 'Gilang',
]
const FIRST_F = [
  'Ayu', 'Bunga', 'Citra', 'Dewi', 'Elsa', 'Fitri', 'Gita', 'Hana', 'Indah', 'Jihan',
  'Kirana', 'Laras', 'Maya', 'Nadia', 'Putri', 'Rani', 'Salsa', 'Tiara', 'Wulan', 'Zahra',
]
const LAST = [
  'Pratama', 'Saputra', 'Wijaya', 'Hidayat', 'Nugroho', 'Lestari', 'Rahmawati', 'Kusuma',
  'Santoso', 'Permata', 'Maulana', 'Ramadhan', 'Anggraini', 'Setiawan', 'Purnama', 'Utami',
  'Firmansyah', 'Handayani', 'Syahputra', 'Wulandari',
]
const SUBJECTS: [string, string][] = [
  ['MTK', 'Matematika'],
  ['BIN', 'Bahasa Indonesia'],
  ['BIG', 'Bahasa Inggris'],
  ['PKN', 'Pendidikan Pancasila'],
  ['PAI', 'Pendidikan Agama'],
  ['PJOK', 'PJOK'],
  ['INF', 'Informatika'],
  ['PRD', 'Produktif Kejuruan'],
  ['SJR', 'Sejarah'],
  ['IPAS', 'Projek IPAS'],
]

const ts = (date: ISODate, time: string) => combineDateTime(date, time)
const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** Menghasilkan SVG data-URL tanda tangan deterministik per nama guru untuk mock Presensi Guru. */
function mockSignatureDataUrl(name: string): string {
  let hash = 2166136261
  for (let i = 0; i < name.length; i += 1) {
    hash ^= name.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const h = hash >>> 0
  const y1 = 22 + (h % 14)
  const y2 = 12 + ((h >>> 4) % 16)
  const y3 = 36 + ((h >>> 8) % 14)
  const y4 = 16 + ((h >>> 12) % 18)
  const y5 = 38 + ((h >>> 16) % 12)
  const xMid = 72 + ((h >>> 20) % 28)
  const xEnd = 138 + ((h >>> 24) % 26)
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 64" width="180" height="64">',
    `<path d="M 16 ${y1 + 16} C 30 ${y2}, 44 ${y3}, 60 ${y1} S ${xMid} ${y4}, ${xMid + 24} ${y5 - 12} C ${xMid + 40} ${y2}, 126 ${y3}, ${xEnd} ${y4 + 8}" fill="none" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<path d="M 24 ${y5 + 6} Q 90 ${y5 - 4}, ${xEnd + 8} ${y5 + 2}" fill="none" stroke="#334155" stroke-width="1.3" stroke-linecap="round" opacity="0.8"/>`,
    '</svg>',
  ].join('')
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

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
        {
          id: sem1,
          academicYearId: ayId,
          number: 1,
          name: 'Ganjil',
          startDate: `${ayStart}-07-14`,
          endDate: `${ayStart}-12-19`,
          isActive: sem1Active,
        },
        {
          id: sem2,
          academicYearId: ayId,
          number: 2,
          name: 'Genap',
          startDate: `${ayStart + 1}-01-05`,
          endDate: `${ayStart + 1}-06-27`,
          isActive: !sem1Active,
        },
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
      while (m >= 60) {
        m -= 60
        h += 1
      }
      periods.push({
        id: `per_${sh.code}_${n}`,
        shiftCode: sh.code,
        number: n,
        startTime: start,
        endTime: `${pad(h)}:${pad(m)}`,
        durationMinutes: 40,
      })
      if (n === 4) {
        m += 15
        while (m >= 60) {
          m -= 60
          h += 1
        }
      }
    }
  }

  const subjects: Subject[] = SUBJECTS.map(([code, name], i) => ({ id: `sub_${i + 1}`, code, name }))

  const extractedTeachers = extractSmkPelitaNusantaraTeachers()
  const extraTeacherRand = mulberry32(20261027)
  const teachers: Teacher[] = extractedTeachers.map((entry, i) => {
    const phoneDigits = i < 16 ? Math.floor(rand() * 1e8) : Math.floor(extraTeacherRand() * 1e8)
    return {
      id: `tch_${i + 1}`,
      nip: `19${70 + (i % 25)}${pad((i % 12) + 1)}${pad((i % 27) + 1)}20${pad(10 + (i % 15))}0${(i % 2) + 1}${pad(i + 1, 3)}`,
      code: entry.code,
      name: entry.name,
      phone: `0812${pad(phoneDigits, 8)}`,
      subjectIds: [`sub_${(i % 10) + 1}`, `sub_${((i + 3) % 10) + 1}`],
      attendanceDays: entry.attendanceDays,
      attendanceOrder: entry.attendanceOrder,
      status: 'ACTIVE',
      userId: null,
    }
  })

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
  const homeroomOrder = ['tch_3', 'tch_5', 'tch_7', 'tch_9', 'tch_11', 'tch_13', 'tch_15']
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

  const timetable: TimetableSlot[] = []
  for (let dow = 1; dow <= 7; dow++) {
    ;(['MORNING', 'AFTERNOON'] as const).forEach((shiftCode, si) => {
      const shiftClasses = classes.filter((c) => c.shiftCode === shiftCode)
      shiftClasses.forEach((c, cIdx) => {
        for (let k = 0; k < 4; k++) {
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
    { id: 'usr_piket', username: 'piket', password: 'password', name: teachers[1]!.name, email: 'piket@sekolah.example.id', roles: ['DUTY_TEACHER'], teacherId: 'tch_2', status: 'ACTIVE' },
    { id: 'usr_piket_2', username: 'piket.budi', password: 'password', name: teachers[0]!.name, email: null, roles: ['DUTY_TEACHER'], teacherId: 'tch_1', status: 'ACTIVE' },
    { id: 'usr_piket_3', username: 'piket.tiga', password: 'password', name: teachers[2]!.name, email: null, roles: ['DUTY_TEACHER'], teacherId: 'tch_3', status: 'ACTIVE' },
    { id: 'usr_piket_ops', username: 'operator.piket', password: 'password', name: 'Yulia Rahman (Operator Piket)', email: 'operator@sekolah.example.id', roles: ['DUTY_TEACHER'], teacherId: null, status: 'ACTIVE' },
    { id: 'usr_piket_lama', username: 'piket.lama', password: 'password', name: 'Siti Aminah', email: null, roles: ['DUTY_TEACHER'], teacherId: null, status: 'INACTIVE' },
  ]
  for (const u of users) {
    const t = teachers.find((x) => x.id === u.teacherId)
    if (t) t.userId = u.id
  }

  const dutyAssignments: DutyAssignment[] = []
  for (let dow = 1; dow <= 7; dow++) {
    dutyAssignments.push({ id: `duty_${dow}_M`, dayOfWeek: dow, date: null, shiftCode: 'MORNING', teacherIds: ['tch_2', `tch_${((dow + 3) % 6) + 3}`], note: null })
    dutyAssignments.push({ id: `duty_${dow}_A`, dayOfWeek: dow, date: null, shiftCode: 'AFTERNOON', teacherIds: ['tch_2', `tch_${((dow + 1) % 6) + 10}`], note: null })
  }

  const slotsFor = (date: ISODate) => timetable.filter((s) => s.dayOfWeek === isoDayOfWeek(date))
  const shiftOfTeacher = (tid: ID) => (Number(tid.split('_')[1]) <= 8 ? 'MORNING' : 'AFTERNOON')
  const periodStartTime = (shiftCode: string, n: number) =>
    periods.find((p) => p.shiftCode === shiftCode && p.number === n)?.startTime ?? '07:00'

  const studentSessions: StoredSession[] = []
  const studentRecords: StudentAttendanceRecord[] = []
  const teacherAttendance: TeacherAttendance[] = []
  const substitutions: SubstitutionRecord[] = []
  const manualEmptySlots: ManualEmptySlot[] = []
  const teachingLogs: TeachingLog[] = []
  const auditLogs: AuditLog[] = []

  const REASONS: Partial<Record<AttendanceStatus, string[]>> = {
    SICK: ['Surat keterangan sakit dari puskesmas', 'Demam', 'Kontrol kesehatan'],
    PERMISSION: ['Surat izin keperluan keluarga', 'Mengikuti lomba LKS tingkat kota', 'Acara keluarga'],
    ABSENT: [],
    EXCUSED: ['Dispensasi lomba olahraga daerah', 'Rapat OSIS di aula sekolah'],
    PKL: ['Praktik Kerja Lapangan di PT Telkom', 'PKL semester ganjil di industri mitra'],
  }
  const TEACHER_REASONS: Partial<Record<TeacherAttendanceStatus, string[]>> = {
    SICK: ['Demam', 'Kontrol kesehatan'],
    PERMISSION: ['Keperluan keluarga', 'Mengantar orang tua berobat'],
    OFFICIAL_DUTY: ['Workshop kurikulum di dinas', 'Pendampingan lomba siswa'],
    ABSENT: ['Tanpa keterangan'],
  }

  function pickHistoryStudentStatus(): AttendanceStatus {
    const r = rand()
    if (r < 0.89) return 'PRESENT'
    if (r < 0.925) return 'SICK'
    if (r < 0.95) return 'PERMISSION'
    if (r < 0.97) return 'ABSENT'
    if (r < 0.985) return 'EXCUSED'
    return 'PKL'
  }

  const historyDates: ISODate[] = []
  for (let i = 10; i >= 1; i--) {
    const d = addDays(today, -i)
    if (isoDayOfWeek(d) !== 7) historyDates.push(d)
  }

  const piketUser = users[0] as MockUser
  const piket2User = users[1] as MockUser

  const makeSession = (
    date: ISODate,
    c: (typeof classes)[number],
    status: StoredSession['status'],
    creator: MockUser,
    forcedStatuses?: Map<number, { status: AttendanceStatus; reason: string | null }>,
  ) => {
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
      submittedAt: ts(date, c.shiftCode === 'MORNING' ? '07:25' : '12:55'),
      submittedBy: creator.id,
      submittedByName: creator.name,
      version: 1,
    })
    const roster = students.filter(
      (s) => s.classId === c.id && (s.status === 'ACTIVE' || (s.inactiveFrom && date < s.inactiveFrom)),
    )
    roster.forEach((s, idx) => {
      const forced = forcedStatuses?.get(idx)
      const st = forced ? forced.status : forcedStatuses ? 'PRESENT' : pickHistoryStudentStatus()
      const reasons = REASONS[st]
      const reason = forced
        ? forced.reason
        : reasons && reasons.length > 0
          ? pickN(reasons)
          : null
      studentRecords.push({
        id: `rec_${sessionId.slice(4)}_${s.id.slice(4)}`,
        sessionId,
        studentId: s.id,
        studentName: s.name,
        studentNis: s.nis,
        status: st,
        arrivalTime: null,
        reason,
        note: null,
        updatedAt: createdAt,
        updatedBy: creator.id,
        updatedByName: creator.name,
        version: 1,
      })
    })
  }

  for (const d of historyDates) {
    for (const c of classes) makeSession(d, c, 'FINAL', piketUser)
  }

  // Hari ini: seed deterministik 7 siswa tidak hadir mencakup seluruh 5 status (S, I, A, D, P).
  makeSession(
    today,
    classes[0]!,
    'FINAL',
    piketUser,
    new Map([
      [0, { status: 'SICK', reason: 'Surat keterangan sakit dari puskesmas' }],
      [1, { status: 'ABSENT', reason: null }],
    ]),
  )
  makeSession(
    today,
    classes[1]!,
    'FINAL',
    piketUser,
    new Map([
      [0, { status: 'PERMISSION', reason: 'Surat izin keperluan keluarga' }],
      [2, { status: 'EXCUSED', reason: 'Mengikuti lomba LKS tingkat kota' }],
    ]),
  )
  makeSession(
    today,
    classes[2]!,
    'FINAL',
    piket2User,
    new Map([
      [1, { status: 'PKL', reason: 'Praktik Kerja Lapangan di industri mitra' }],
      [3, { status: 'SICK', reason: 'Konfirmasi wali murid via WhatsApp' }],
    ]),
  )
  makeSession(
    today,
    classes[3]!,
    'FINAL',
    piketUser,
    new Map([[0, { status: 'ABSENT', reason: null }]]),
  )

  /* -------------------------------------------------- absensi guru + jam kosong + agenda guru */
  const absentPlan = new Map<string, TeacherAttendanceStatus>()
  for (const d of historyDates) {
    for (const t of teachers) {
      const r = rand()
      if (r < 0.04) absentPlan.set(`${d}|${t.id}`, 'SICK')
      else if (r < 0.065) absentPlan.set(`${d}|${t.id}`, 'PERMISSION')
      else if (r < 0.075) absentPlan.set(`${d}|${t.id}`, 'OFFICIAL_DUTY')
      else if (r < 0.08) absentPlan.set(`${d}|${t.id}`, 'ABSENT')
      else if (r < 0.12) absentPlan.set(`${d}|${t.id}`, 'LATE')
    }
  }
  absentPlan.set(`${today}|tch_4`, 'SICK')
  absentPlan.set(`${today}|tch_6`, 'PERMISSION')
  absentPlan.set(`${today}|tch_12`, 'OFFICIAL_DUTY')

  const allDates = [...historyDates, today]
  const TOPICS = [
    'REST API & Autentikasi',
    'Normalisasi & ERD Basis Data',
    'Dasar PPLG & Algoritma',
    'UML Sequence Diagram',
    'Konfigurasi Router Statis',
    'VLAN & Trunking Switch',
    'Crimping Kabel UTP',
    'Persamaan Linear & Matriks',
    'Teks Laporan Hasil Observasi',
    'Analisis Transaksi Akuntansi',
  ]

  for (const d of allDates) {
    const daySlots = slotsFor(d)
    for (const t of teachers) {
      const tSlots = daySlots.filter((s) => s.teacherId === t.id)
      if (tSlots.length === 0) continue
      const shiftCode = shiftOfTeacher(t.id)
      const shift = shifts.find((s) => s.code === shiftCode) as Shift
      const planned = absentPlan.get(`${d}|${t.id}`) ?? 'PRESENT'
      const isToday = d === today
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

    // Jam kosong: hari ini 2 slot sudah ditugaskan guru piket, sisanya belum ditugaskan
    const busyAt = (tid: ID, shiftCode: string, ps: number) =>
      daySlots.some((s) => s.teacherId === tid && s.shiftCode === shiftCode && s.periodStart === ps) ||
      substitutions.some(
        (r) => r.date === d && r.substituteTeacherId === tid && r.shiftCode === shiftCode && r.periodStart === ps,
      )
    let todayHandled = 0
    for (const s of daySlots) {
      const st = absentPlan.get(`${d}|${s.teacherId}`)
      if (!st || !TEACHER_ABSENT_STATUSES.includes(st)) continue
      const handle = d === today ? todayHandled++ < 2 : rand() < 0.75
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
        manualSlotId: null,
        classId: s.classId,
        subjectId: s.subjectId,
        absentTeacherId: s.teacherId,
        substituteTeacherId: candidate.id,
        substituteTeacherName: candidate.name,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        periodCount: s.periodCount,
        activity: pickN(['Mengerjakan tugas dari guru mapel', 'Latihan soal', 'Diskusi kelompok']),
        note: null,
        status: 'ACTIVE',
        conflictOverridden: false,
        overrideReason: null,
        teachingLogId: null,
        createdByName: piketUser.name,
        createdAt: ts(d, '07:30'),
      })
    }

    // Agenda Guru (Kegiatan Mengajar): di-seed untuk histori DAN hari ini dengan TTD read-only dari Presensi Guru.
    const selectedSlots = d === today ? daySlots.slice(0, 14) : daySlots.filter(() => rand() <= 0.75)
    selectedSlots.forEach((s, idx) => {
      const t = teachers.find((x) => x.id === s.teacherId) as Teacher
      const c = classes.find((x) => x.id === s.classId)!
      const subj = subjects.find((x) => x.id === s.subjectId)!
      const teacherAbsent = TEACHER_ABSENT_STATUSES.includes(absentPlan.get(`${d}|${s.teacherId}`) ?? 'PRESENT')
      const signed = d === today ? idx < 9 : idx % 6 !== 5
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
        meetingNumber: 10 + (idx % 5),
        topic: teacherAbsent
          ? 'Tugas Mandiri (Guru Piket)'
          : TOPICS[idx % TOPICS.length] ?? `${subj.name}: Materi terjadwal`,
        activity: teacherAbsent ? 'Penugasan mandiri di kelas' : 'Pembelajaran tatap muka & praktik',
        note: null,
        teacherPresence: teacherAbsent ? 'PERMISSION' : 'PRESENT',
        execution: 'HELD',
        notHeldReason: null,
        studentSick: 0,
        studentPermission: 0,
        studentAbsent: 0,
        substitutionRecordId: null,
        status: 'FINAL',
        signatureUrl: signed ? mockSignatureDataUrl(t.name) : null,
        signedAt: signed ? ts(d, periodStartTime(s.shiftCode, s.periodStart)) : null,
        submittedAt: ts(d, periodStartTime(s.shiftCode, s.periodEnd)),
        approvedAt: null,
        approvedByName: null,
        createdAt: ts(d, periodStartTime(s.shiftCode, s.periodStart)),
        updatedAt: ts(d, periodStartTime(s.shiftCode, s.periodStart)),
        version: 1,
      })
    })
  }

  /* -------------------------------------------------- jam tambahan (multi-kelas + TTD read-only) */
  const extraActivities: ExtraActivity[] = [
    {
      id: 'ext_today_1',
      name: 'Jam Tambahan Matematika XII',
      type: 'EXTRA_HOURS',
      instructorTeacherId: teachers[0]!.id,
      instructorName: teachers[0]!.name,
      coordinatorUserId: piketUser.id,
      date: today,
      shiftCode: 'AFTERNOON',
      startTime: '13:00',
      endTime: '14:30',
      classIds: ['cls_4', 'cls_3'],
      classNames: ['XII TKJ 1', 'XI TKJ 1'],
      topic: 'Latihan soal persiapan asesmen akhir',
      note: null,
      status: 'FINAL',
      signatureUrl: mockSignatureDataUrl(teachers[0]!.name),
      signedAt: ts(today, '13:10'),
      createdAt: ts(today, '12:45'),
      version: 1,
    },
    {
      id: 'ext_today_2',
      name: 'Bimbingan Persiapan LKS Jaringan',
      type: 'COURSE',
      instructorTeacherId: teachers[2]!.id,
      instructorName: teachers[2]!.name,
      coordinatorUserId: piketUser.id,
      date: today,
      shiftCode: 'AFTERNOON',
      startTime: '14:00',
      endTime: '15:30',
      classIds: ['cls_1', 'cls_3', 'cls_4'],
      classNames: ['X TKJ 1', 'XI TKJ 1', 'XII TKJ 1'],
      topic: 'Simulasi routing OSPF & firewall Mikrotik',
      note: null,
      status: 'FINAL',
      signatureUrl: null,
      signedAt: null,
      createdAt: ts(today, '13:30'),
      version: 1,
    },
    {
      id: 'ext_today_3',
      name: 'Klinik Akuntansi Dasar',
      type: 'EXTRA_HOURS',
      instructorTeacherId: teachers[4]!.id,
      instructorName: teachers[4]!.name,
      coordinatorUserId: piketUser.id,
      date: today,
      shiftCode: 'MORNING',
      startTime: '11:30',
      endTime: '12:30',
      classIds: ['cls_2'],
      classNames: ['X AKL 1'],
      topic: 'Penyusunan jurnal penyesuaian dan neraca lajur',
      note: null,
      status: 'FINAL',
      signatureUrl: mockSignatureDataUrl(teachers[4]!.name),
      signedAt: ts(today, '12:00'),
      createdAt: ts(today, '11:15'),
      version: 1,
    },
    {
      id: 'ext_today_4',
      name: 'English Conversation Club',
      type: 'COURSE',
      instructorTeacherId: teachers[6]!.id,
      instructorName: teachers[6]!.name,
      coordinatorUserId: piketUser.id,
      date: today,
      shiftCode: 'AFTERNOON',
      startTime: '15:30',
      endTime: '16:45',
      classIds: ['cls_5', 'cls_6'],
      classNames: ['X TKJ 2', 'X MPLB 1'],
      topic: 'Interview practice untuk kesiapan PKL',
      note: null,
      status: 'FINAL',
      signatureUrl: null,
      signedAt: null,
      createdAt: ts(today, '10:00'),
      version: 1,
    },
    {
      id: 'ext_today_5',
      name: 'Pendalaman Pemrograman Web',
      type: 'EXTRA_HOURS',
      instructorTeacherId: teachers[7]!.id,
      instructorName: teachers[7]!.name,
      coordinatorUserId: piketUser.id,
      date: today,
      shiftCode: 'AFTERNOON',
      startTime: '15:00',
      endTime: '16:30',
      classIds: ['cls_1', 'cls_3'],
      classNames: ['X TKJ 1', 'XI TKJ 1'],
      topic: 'Integrasi REST API & validasi formulir',
      note: null,
      status: 'FINAL',
      signatureUrl: mockSignatureDataUrl(teachers[7]!.name),
      signedAt: ts(today, '15:15'),
      createdAt: ts(today, '10:30'),
      version: 1,
    },
    {
      id: 'ext_prev_1',
      name: 'Kursus Sertifikasi Jaringan',
      type: 'COURSE',
      instructorTeacherId: teachers[7]!.id,
      instructorName: teachers[7]!.name,
      coordinatorUserId: piketUser.id,
      date: addDays(today, -1),
      shiftCode: 'AFTERNOON',
      startTime: '13:00',
      endTime: '15:00',
      classIds: ['cls_3', 'cls_4'],
      classNames: ['XI TKJ 1', 'XII TKJ 1'],
      topic: 'Konfigurasi VLAN dan routing dasar',
      note: null,
      status: 'FINAL',
      signatureUrl: mockSignatureDataUrl(teachers[7]!.name),
      signedAt: ts(addDays(today, -1), '14:30'),
      createdAt: ts(addDays(today, -2), '10:00'),
      version: 1,
    },
  ]

  const loginEvents = seedAccountHistory(users, today)

  const settings: SchoolSettings = {
    schoolName: 'SMK Plus Pelita Nusantara',
    schoolAddress: 'Jl. Pendidikan No. 1',
    letterheadLines: ['SMK PLUS PELITA NUSANTARA'],
    principalName: 'Drs. Hartono, M.Pd.',
    principalNip: '196805121994031005',
    city: 'Kabupaten Bogor',
    timezone: 'Asia/Jakarta',
    schoolDays: [1, 2, 3, 4, 5, 6],
    attendanceStatuses: [
      { code: 'PRESENT', label: 'Hadir', shortCode: 'H', requiresReason: false, active: true },
      { code: 'SICK', label: 'Sakit', shortCode: 'S', requiresReason: false, active: true },
      { code: 'PERMISSION', label: 'Izin', shortCode: 'I', requiresReason: false, active: true },
      { code: 'ABSENT', label: 'Alpa', shortCode: 'A', requiresReason: false, active: true },
      { code: 'EXCUSED', label: 'Dispensasi', shortCode: 'D', requiresReason: false, active: true },
      { code: 'PKL', label: 'PKL', shortCode: 'P', requiresReason: false, active: true },
    ],
    teacherReasonRequiredStatuses: ['SICK', 'PERMISSION', 'ABSENT', 'OFFICIAL_DUTY'],
    dismissalRequiresPickup: true,
    dutyNoteCategories: ['Kejadian', 'Tamu', 'Kedisiplinan', 'Lainnya'],
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
    teacherAttendance,
    dutyAssignments,
    manualEmptySlots,
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

function seedAccountHistory(users: MockUser[], today: ISODate): LoginEvent[] {
  const rand = mulberry32(7331)
  const nowMs = Date.now()
  const minutesToday = wallTimeToMinutes(nowWallTime())
  const events: LoginEvent[] = []
  let seq = 0
  const timeOn = (offset: number): ISODateTime => {
    if (offset === 0) {
      const maxBack = Math.max(1, minutesToday - 1)
      const back = 1 + Math.floor(rand() * Math.min(maxBack, 600))
      return toISODateTime(new Date(nowMs - Math.min(back, maxBack) * 60_000 - 1_000))
    }
    const minute = 6 * 60 + Math.floor(rand() * 10 * 60)
    return combineDateTime(addDays(today, -offset), `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`)
  }
  const push = (e: Omit<LoginEvent, 'id'>) => {
    seq += 1
    events.push({ id: `lgn_seed_${pad(seq, 3)}`, ...e })
  }

  for (const u of users) {
    u.version = 1
    u.mustChangePassword = false
    u.createdAt = combineDateTime(addDays(today, -60), '08:00')
    u.updatedAt = u.createdAt
    if (u.status !== 'ACTIVE') continue
    for (let offset = 4; offset >= 0; offset--) {
      if (rand() < 0.78) {
        push({ timestamp: timeOn(offset), userId: u.id, username: u.username, success: true, reason: 'OK' })
      }
    }
  }

  events.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  for (const u of users) {
    const last = events.find((e) => e.userId === u.id && e.success)
    if (last) u.lastLoginAt = last.timestamp
    else u.lastLoginAt ??= null
  }
  return events
}
