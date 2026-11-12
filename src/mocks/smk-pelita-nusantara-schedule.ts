/**
 * Data jadwal kehadiran guru (Senin–Sabtu) sesuai dokumen resmi:
 * YAYASAN PELITA NUSANTARA BOGOR — SMK PLUS PELITA NUSANTARA BOGOR
 * JADWAL KEHADIRAN GURU TAHUN AJARAN 2026-2027 SEMESTER GANJIL
 *
 * Setiap baris merepresentasikan nomor urut 1..45 pada kolom:
 * [SENIN, SELASA, RABU, KAMIS, JUMAT, SABTU] dengan pasangan [nama, kode] atau null bila kosong.
 */

export type MatrixCellSeed = readonly [name: string, code: string] | null

export interface PresenceMatrixSeedRow {
  no: number
  /** Indeks 0 = Senin (1) ... Indeks 5 = Sabtu (6) */
  days: readonly [
    MatrixCellSeed,
    MatrixCellSeed,
    MatrixCellSeed,
    MatrixCellSeed,
    MatrixCellSeed,
    MatrixCellSeed,
  ]
}

export const SMK_PELITA_NUSANTARA_MATRIX_ROWS: readonly PresenceMatrixSeedRow[] = [
  {
    no: 1,
    days: [
      ['Septianto Raharso, S.Kom., M.Pd.', '21'],
      ['Putri Ngawirabaya, S.S', '16'],
      ['Raihana Yasmin Azzahra, S.Kel.', '8'],
      ['Siti Kholifah, S.Pd.I', '41'],
      ['Septianto R. S.Kom, M.Pd', '21'],
      ['Septianto Raharso, S.Kom., M.Pd.', '21'],
    ],
  },
  {
    no: 2,
    days: [
      ['Mieke Rahmawaty, S.Kom', '14'],
      ['Dita Wulandari, S.TP', '7'],
      ['Mieke Rahmawaty, S.Kom', '14'],
      ['Suci Romadini, S.Kom', '23'],
      ['Siti Kholifah, S.Pd.I', '41'],
      ['Luthfi Abdul Rahman, S.Pd.', '57'],
    ],
  },
  {
    no: 3,
    days: [
      ['Sopiyan, S.Hi., M.A.', '3'],
      ['Mieke Rahmawaty, S.Kom', '14'],
      ['Dita Wulandari, S.TP', '7'],
      ['Indah Rahmadhanty, S.Pd', '42'],
      ['Ari Zulfikar, S.Pd.,Gr.', '31'],
      ['Abdul Choir, S.Kom', '62'],
    ],
  },
  {
    no: 4,
    days: [
      ['Fitri Rohmayasari, S.Pd.', '47'],
      ['Annisa Febiyanti, S.I.Kom', '59'],
      ['Suci Romadini, S.Kom', '23'],
      ['Alfi Hardian, S.Sn', '32'],
      ['Sopiyan, S.Hi., M.A.', '3'],
      ['Erfan Bayu Saputra, S.E', '25'],
    ],
  },
  {
    no: 5,
    days: [
      ['Farida Awalia, S.Pd.', '22'],
      ['Farida Awalia, S.Pd.', '22'],
      ['Yaumil Akbaria, S.Pd', '40'],
      ['Nani Yuliawati Ningsih, S.Pd.', '48'],
      ['Farida Awalia, S.Pd.,Gr', '22'],
      ['Muzakir Zulkarnaen, S.Ak', '44'],
    ],
  },
  {
    no: 6,
    days: [
      ['Yaumil Akbaria, S.Pd.', '40'],
      ['Asit Rahmah, S.Pd.', '20'],
      ['Farida Awalia, S.Pd.', '22'],
      ['Silfa Tsania, S.Pd.', '61'],
      ['Nani Yuliawati Ningsih, S.Pd.', '48'],
      ['Muhamad Adib, S.E', '43'],
    ],
  },
  {
    no: 7,
    days: [
      ['Muzakir Zulkarnaen, S.Ak', '44'],
      ['Ika Sartika, S.Pd.,Gr.', '19'],
      ['Mustamah, S.Pd.I, MM.', '37'],
      ['Muhamad Adib, S.E', '43'],
      ['Yaumil Akbaria, S.Pd', '40'],
      ['Eka Putra Nugraha, S.M., M.M.S.I', '49'],
    ],
  },
  {
    no: 8,
    days: [
      ['Akbar Maulana, S.Pd.', '11'],
      ['Indah Ramadhanty, S.Pd.', '42'],
      ['Ika Sartika, S.Pd.,Gr.', '19'],
      ['Dita Wulandari, S.TP', '7'],
      ['Ashifa Ramadanty, S.Pd', '50'],
      ['Raden Roro', 'A71'],
    ],
  },
  {
    no: 9,
    days: [
      ['Karti Suminar, M.Pd.', '18'],
      ['Karti Suminar, M.Pd.', '18'],
      ['Annisa Febiyanti, S.I.Kom', '59'],
      ['Abdul Choir, S.Kom', '62'],
      ['Silfa Tsania, S.Pd.', '61'],
      ['Sri Rahayu', 'A73'],
    ],
  },
  {
    no: 10,
    days: [
      ['Diana Rosita, S.Pd.I', '13'],
      ['Raihana Yasmin Azzahra, S.Kel.', '8'],
      ['Fitri Rohmayasari, S.Pd.,Gr', '47'],
      ["Syahidah Muthi'ah, S.Pd.", '63'],
      ["Syahidah Muthi'ah, S.Pd.", '63'],
      ['Annito Rizka, S.S', 'A68'],
    ],
  },
  {
    no: 11,
    days: [
      ['Raihana Yasmin Azzahra, S.Kel.', '8'],
      ['Vivin Dwi Yudianto, S.Pd.', '10'],
      ['Septia Sundari, S.Pd.,Gr', '24'],
      ['Septianto R. S.Kom, M.Pd', '21'],
      ['Akbar Maulana, S.Pd.,Gr.', '11'],
      ['Putri Ngawirabaya, S.S', '16'],
    ],
  },
  {
    no: 12,
    days: [
      ['Luthfi Abdul Rahman, S.Pd.', '57'],
      ['Ryan Syahrul', '46'],
      ['Sulthan Alawy Shihab, S.Kom', '52'],
      ['Diana Rosita, S.Pd.I', '13'],
      ['Diana Rosita, S.Pd.I', '13'],
      ['Karti Suminar, M.Pd.', '18'],
    ],
  },
  {
    no: 13,
    days: [
      ['Abdul Choir, S.Kom', '62'],
      ['Suci Romadini, S.Kom', '23'],
      ['Luthfi Abdul Rahman, S.Pd.', '57'],
      ['Akbar Maulana, S.Pd.,Gr.', '11'],
      ['Septia Sundari, S.Pd.,Gr', '24'],
      ['Ika Sartika, S.Pd.', '19'],
    ],
  },
  {
    no: 14,
    days: [
      ['Dewi Ratnawati, S.Pd.', '36'],
      ['Muhamad Nurcholis Majid, S.Kom', '26'],
      ['Akbar Maulana, S.Pd.,Gr.', '11'],
      ['Mieke Rahmawaty, S.Kom', '14'],
      ['Mustamah, S.Pd.I, MM.', '37'],
      ['Farida Awalia, S.Pd.', '22'],
    ],
  },
  {
    no: 15,
    days: [
      ['Alfi Hardian, S.Sn', '32'],
      ['Dewi Ratnawati, S.Pd.', '36'],
      ['Alfi Hardian, S.Sn', '32'],
      ['Nitta Lestari, S.Kom.,Gr.', '9'],
      ['Ika Sartika, S.Pd.,Gr.', '19'],
      ['Fatih Alfaresa', 'A74'],
    ],
  },
  {
    no: 16,
    days: [
      ['Putri Ngawirabaya, S.S', '16'],
      ['Alfi Hardian, S.Sn', '32'],
      ['Muhamad Nurcholis Majid, S.Kom', '26'],
      ['Alvi Luviani, S.I. Kom.,Gr.', '30'],
      ['Indah Rahmadhanty, S.Pd', '42'],
      ['Fergio Gustavio', 'A72'],
    ],
  },
  {
    no: 17,
    days: [
      ['Asit Rahmah, S.Pd.', '20'],
      ['Ashifa Ramadanty, S.Pd', '50'],
      ['Putri Ngawirabaya, S.S', '16'],
      ['Ashifa Ramadanty, S.Pd', '50'],
      ['Hanifan Nurfauzi, M.Ag', '28'],
      ['Betty Seprihandayani, M.Pd.', 'A63'],
    ],
  },
  {
    no: 18,
    days: [
      ['Muhamad Adib, S.E', '43'],
      ['Muzakir Zulkarnaen, S.Ak', '44'],
      ['Rizni Fauziah, S.Tr.Akun', '15'],
      ['Erfan Bayu Saputra, S.E', '25'],
      ['Dewi Ratnawati, S.Pd.', '36'],
      ['Rini Susilowati, M.Pd.', 'A64'],
    ],
  },
  {
    no: 19,
    days: [
      ["Syahidah Muthi'ah, S.Pd.", '63'],
      ['Septia Sundari, S.Pd.', '24'],
      ['Ashifa Ramadanty, S.Pd', '50'],
      ['Rizni Fauziah, S.Tr.Akun.,Gr.', '15'],
      ['Annisa Febiyanti, S.I.Kom', '59'],
      ['Naumi Anggita Larasati, S.Pd.', 'A65'],
    ],
  },
  {
    no: 20,
    days: [
      ['Mustamah, S.Pd.I., M.M', '37'],
      ['Sulthan Alawy Shihab, S.Kom', '52'],
      ["Syahidah Muthi'ah, S.Pd.", '63'],
      ['Vivin Dwi Yudianto, S.Pd.,Gr.', '10'],
      ['Vivin Dwi Yudianto, S.Pd.,Gr.', '10'],
      ['Delfi Waldia, S.Pd.', 'A66'],
    ],
  },
  {
    no: 21,
    days: [
      ['Sulthan Alawy Shihab, S.Kom', '52'],
      ['Septianto Raharso, S.Kom., M.Pd.', '21'],
      ['Yulianie Kasari, M.Pd.', '51'],
      ['Ika Sartika, S.Pd.,Gr.', '19'],
      ['Rohajon, S.T', '4'],
      ['Imas Masrohah, S.Pd.', 'A67'],
    ],
  },
  {
    no: 22,
    days: [
      ['Qurotta Umi Kulsum, S.Pd.', '60'],
      ['Luthfi Abdul Rahman, S.Pd.', '57'],
      ['Bagoes Setya Ananda', '65'],
      ['Dewi Ratnawati, S.Pd.', '36'],
      ['Sulthan Alawy Shihab, S.Kom', '52'],
      ['Rakhma Dhania, S.Pd.,Gr.', '17'],
    ],
  },
  {
    no: 23,
    days: [
      ['Ryan Syahrul', '46'],
      ['Sopiyan, S.Hi., M.A', '3'],
      ['Qurotta Umi Kulsum, S.Pd.', '60'],
      ['Farida Awalia, S.Pd.,Gr', '22'],
      ['Yulianie Kasari, M.Pd.', '51'],
      ['R. Dodi Setiadi, S.Pd.I', '29'],
    ],
  },
  {
    no: 24,
    days: [
      ['Suci Romadini, S.Kom', '23'],
      ['Qurotta Umi Kulsum, S.Pd.', '60'],
      ['Abdul Choir, S.Kom', '62'],
      ['Luthfi Abdul Rahman, S.Pd.', '57'],
      ['Abdul Choir, S.Kom', '62'],
      ['Sholehudin Aditya Utama, S.Pd', '27'],
    ],
  },
  {
    no: 25,
    days: [
      ['Nitta Lestari, S.Kom', '9'],
      ['Abdul Fadhilah, S.I.Kom', '54'],
      ['Abdul Fadhilah, S.I.Kom', '54'],
      ['Fitri Rohmayasari, S.Pd.,Gr', '47'],
      ['Suci Romadini, S.Kom', '23'],
      ['Anisah Dwi Rahayu, S.Pd', '33'],
    ],
  },
  {
    no: 26,
    days: [
      ['Muhamad Nurcholis Majid, S.Kom', '26'],
      ['Fitri Rohmayasari, S.Pd.,Gr', '47'],
      ['Alvi Luviani, S.I.Kom', '30'],
      ['Karti Suminar, M.Pd.,Gr.', '18'],
      ['Luthfi Abdul Rahman, S.Pd.', '57'],
      ['Ariska Dwi Saputri, S.Pd', '35'],
    ],
  },
  {
    no: 27,
    days: [
      ['Alvi Luviani, S.I.Kom', '30'],
      ['Nitta Lestari, S.Kom', '9'],
      ['Karti Suminar, M.Pd.,Gr.', '18'],
      ['Septia Sundari, S.Pd.,Gr', '24'],
      ['Karti Suminar, M.Pd.,Gr.', '18'],
      ['Anita Lestari, S.Pd', '34'],
    ],
  },
  {
    no: 28,
    days: [
      ['Septia Sundari, S.Pd.', '24'],
      ['Alvi Luviani, S.I.Kom', '30'],
      ['Nitta Lestari, S.Kom', '9'],
      ['Amirul Hadid R., M.Pd., Gr.', '6'],
      ['M. Nurcholis Majid, S.Kom', '26'],
      ['Wilda Septiarini, S.Pd', '38'],
    ],
  },
  {
    no: 29,
    days: [
      ['Rizni Fauziah, S.Tr.Akun', '15'],
      ['Erfan Bayu Saputra, S.E', '25'],
      ['Muzakir Zulkarnaen, S.Ak', '44'],
      ['Yulianie Kasari, M.Pd.', '51'],
      ['Alvi Luviani, S.I. Kom.,Gr.', '30'],
      ['Ardi Sukma, S.H', '39'],
    ],
  },
  {
    no: 30,
    days: [
      ['Erfan Bayu Saputra, S.E', '25'],
      ['Rizni Fauziah, S.Tr.Akun', '15'],
      ['Nurwanti Ayu, S.Mat.', '53'],
      ['Putri Ngawirabaya, S.S.,Gr.', '16'],
      ['Nugrah Dwi Saptaji, S.Psi', '5'],
      ['Yulianie Kasari, M.Pd.', '51'],
    ],
  },
  {
    no: 31,
    days: [
      ['Indah Ramadhanty, S.Pd.', '42'],
      ['Bagoes Setya Ananda', '65'],
      ['Nugrah Dwi Saptaji, S.Psi', '5'],
      ['Rakhma Dhania, S.Pd.,Gr.', '17'],
      ['Nurwanti Ayu, S.Mat.', '53'],
      ['Rizni Fauziah, S.Tr.Akun', '15'],
    ],
  },
  {
    no: 32,
    days: [
      ['Ari Zulfikar, S.Pd.', '31'],
      ['Yulianie Kasari, M.Pd.', '51'],
      ['Siti Kholifah, S.Pd.I', '41'],
      ['Nurulia Falah, S.Sos.,M.Pd.', '45'],
      ['Fitri Rohmayasari, S.Pd.,Gr', '47'],
      ['Nitta Lestari, S.Kom', '9'],
    ],
  },
  {
    no: 33,
    days: [
      ['Dita Wulandari, S.TP', '7'],
      ['Muhamad Adib, S.E', '43'],
      ['Vivin Dwi Yudianto, S.Pd.', '10'],
      ['Nugrah Dwi Saptaji, S.Psi', '5'],
      ['Nitta Lestari, S.Kom.,Gr.', '9'],
      ['Mieke Rahmawaty, S.Kom', '14'],
    ],
  },
  {
    no: 34,
    days: [
      ['Vivin Dwi Yudianto, S.Pd.', '10'],
      ['Nurulia Falah, S.Sos.,M.Pd.', '45'],
      ['Erfan Bayu Saputra, S.E', '25'],
      ['Qurotta Umi Kulsum, S.Pd.', '60'],
      ['Rizni Fauziah, S.Tr.Akun.,Gr.', '15'],
      ['Sulthan Alawy Shihab, S.Kom', '52'],
    ],
  },
  {
    no: 35,
    days: [
      ['Silfa Tsania, S.Pd.', '61'],
      ['Diana Rosita, S.Pd.I', '13'],
      ['Indah Rahmadhanty, S.Pd', '42'],
      ['Muzakir Zulkarnain, S.E', '44'],
      ['Erfan Bayu Saputra, S.E', '25'],
      null,
    ],
  },
  {
    no: 36,
    days: [
      ['Ashifa Ramadhanty, S.Pd.', '50'],
      ['Rohajon, S.T', '4'],
      ['Muhamad Adib, S.E', '43'],
      ['Yaumil Akbaria, S.Pd', '40'],
      ['Raihana Yasmin Azzahra, S.Kel.', '8'],
      null,
    ],
  },
  {
    no: 37,
    days: [
      ['Siti Nurjanah, S.Pd.', '70'],
      ['Ari Zulfikar, S.Pd.', '31'],
      ['Arsal Huda Nurrahman, S.Kom', '64'],
      ['M. Nurcholis Majid, S.Kom', '26'],
      ['Bagoes Setya Ananda', '65'],
      null,
    ],
  },
  {
    no: 38,
    days: [
      null,
      ['Abdul Choir, S.Kom', '62'],
      ['Septianto Raharso, S.Kom., M.Pd.', '21'],
      ['Mustamah, S.Pd.I, MM.', '37'],
      ['Rakhma Dhania, S.Pd.,Gr.', '17'],
      null,
    ],
  },
  {
    no: 39,
    days: [
      null,
      ['Rakhma Dhania, S.Pd.,Gr.', '17'],
      ['Dewi Ratnawati, S.Pd.', '36'],
      ['Abdul Fadhilah, S.I.Kom', '54'],
      ['Amirul Hadid R., M.Pd., Gr.', '6'],
      null,
    ],
  },
  {
    no: 40,
    days: [
      null,
      ['Mustamah, S.Pd.I, MM.', '37'],
      ['Siti Nurjanah, S.Pd.', '70'],
      ['Annisa Febiyanti, S.I.Kom', '59'],
      ['Eka Putra Nugraha, S.M., M.M.S.I', '49'],
      null,
    ],
  },
  {
    no: 41,
    days: [
      null,
      ['Siti Nurjanah, S.Pd.', '70'],
      null,
      ['Sulthan Alawy Shihab, S.Kom', '52'],
      ['Siti Nurjanah, S.Pd.', '70'],
      null,
    ],
  },
  {
    no: 42,
    days: [null, null, null, ['Asit Rahmah, S.Pd.,Gr.', '20'], null, null],
  },
  {
    no: 43,
    days: [null, null, null, ['Ari Zulfikar, S.Pd.,Gr.', '31'], null, null],
  },
  {
    no: 44,
    days: [null, null, null, ['Eka Putra Nugraha, S.M., M.M.S.I', '49'], null, null],
  },
  {
    no: 45,
    days: [null, null, null, ['Siti Nurjanah, S.Pd.', '70'], null, null],
  },
]

export interface ExtractedSeedTeacher {
  code: string
  name: string
  attendanceDays: number[]
  attendanceOrder: Record<number, number>
}

/**
 * Mengekstrak daftar guru unik dari matriks 45 baris × 6 hari SMK Plus Pelita Nusantara Bogor,
 * dengan mempertahankan urutan kemunculan pertama agar tch_1..tch_16 stabil untuk jadwal & piket.
 */
export function extractSmkPelitaNusantaraTeachers(): ExtractedSeedTeacher[] {
  const byCode = new Map<string, ExtractedSeedTeacher>()

  for (const row of SMK_PELITA_NUSANTARA_MATRIX_ROWS) {
    row.days.forEach((cell, idx) => {
      if (!cell) return
      const [rawName, rawCode] = cell
      const code = rawCode.trim().toUpperCase()
      const name = rawName.trim()
      const dayOfWeek = idx + 1 // 1=Senin .. 6=Sabtu
      let entry = byCode.get(code)
      if (!entry) {
        entry = {
          code,
          name,
          attendanceDays: [],
          attendanceOrder: {},
        }
        byCode.set(code, entry)
      } else if (name.length > entry.name.length && !name.includes('R. ')) {
        // Pilih penulisan nama yang paling lengkap gelarnya (mis. ", Gr.")
        entry.name = name
      }
      if (!entry.attendanceDays.includes(dayOfWeek)) {
        entry.attendanceDays.push(dayOfWeek)
        entry.attendanceDays.sort((a, b) => a - b)
      }
      if (entry.attendanceOrder[dayOfWeek] === undefined) {
        entry.attendanceOrder[dayOfWeek] = row.no
      }
    })
  }

  return [...byCode.values()]
}

