import { Check, ChevronDown, X } from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { ID, Teacher } from '@/types/entities'

export interface TeacherComboboxValue {
  teacherId: ID | null
  name: string
}

interface TeacherComboboxProps {
  teachers: Pick<Teacher, 'id' | 'name' | 'nip'>[]
  value: TeacherComboboxValue
  onChange: (next: TeacherComboboxValue) => void
  placeholder?: string
  ariaLabel?: string
  id?: string
  disabled?: boolean
  className?: string
  inputClassName?: string
  allowClear?: boolean
}

/**
 * Combobox guru piket/pengganti: pengguna dapat memilih dari daftar guru terdaftar
 * atau mengetik nama bebas secara langsung.
 */
export function TeacherCombobox({
  teachers,
  value,
  onChange,
  placeholder = 'Pilih atau ketik nama guru piket…',
  ariaLabel = 'Nama guru piket',
  id,
  disabled = false,
  className,
  inputClassName,
  allowClear = true,
}: TeacherComboboxProps) {
  const [open, setOpen] = useState(false)
  const blurTimer = useRef<number | null>(null)
  const generatedId = useId()
  const inputId = id ?? generatedId
  const listId = `${inputId}-listbox`

  const filtered = useMemo(() => {
    const q = value.name.trim().toLowerCase()
    if (!q) return teachers.slice(0, 12)
    return teachers
      .filter((t) => t.name.toLowerCase().includes(q) || t.nip.toLowerCase().includes(q))
      .slice(0, 12)
  }, [teachers, value.name])

  const handleInputChange = (raw: string) => {
    const exact = teachers.find((t) => t.name.toLowerCase() === raw.trim().toLowerCase())
    onChange({ teacherId: exact?.id ?? null, name: raw })
    setOpen(true)
  }

  const selectTeacher = (t: Pick<Teacher, 'id' | 'name'>) => {
    onChange({ teacherId: t.id, name: t.name })
    setOpen(false)
  }

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          autoComplete="off"
          disabled={disabled}
          value={value.name}
          placeholder={placeholder}
          className={cn(allowClear && value.name ? 'pr-14' : 'pr-8', inputClassName)}
          onFocus={() => {
            if (blurTimer.current) window.clearTimeout(blurTimer.current)
            setOpen(true)
          }}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setOpen(false), 140)
          }}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
          }}
        />
        <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-0.5">
          {allowClear && value.name && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Hapus isian nama guru"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange({ teacherId: null, name: '' })
                setOpen(false)
              }}
              className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            aria-label="Tampilkan daftar guru"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpen((prev) => !prev)}
            className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none"
          >
            <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
          </button>
        </div>
      </div>

      {open && !disabled && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Saran guru"
          className="absolute right-0 left-0 z-50 mt-1 max-h-52 overflow-y-auto rounded-lg border border-border/90 bg-popover p-1 text-popover-foreground shadow-md shadow-black/5"
        >
          {filtered.length === 0 ? (
            <li className="px-2.5 py-2 text-xs text-muted-foreground">
              {value.name.trim()
                ? `Gunakan nama "${value.name.trim()}" secara manual.`
                : 'Tidak ada data guru tersedia.'}
            </li>
          ) : (
            filtered.map((t) => {
              const selected = value.teacherId === t.id || value.name.trim().toLowerCase() === t.name.toLowerCase()
              return (
                <li key={t.id} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      selectTeacher(t)
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-accent hover:text-accent-foreground',
                      selected && 'bg-accent/70 font-medium text-foreground',
                    )}
                  >
                    <span className="min-w-0 truncate">{t.name}</span>
                    {selected && <Check className="size-3.5 shrink-0 text-primary" aria-hidden />}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
