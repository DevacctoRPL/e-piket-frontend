import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './confirm-dialog'
import { DataTable, type ColumnDef } from './data-table'
import { SearchField } from './search-field'

describe('shared foundation components', () => {
  it('preserves both SearchField change callbacks', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onValueChange = vi.fn()
    function ControlledSearch() {
      const [value, setValue] = useState('')
      return (
        <SearchField
          aria-label="Cari"
          value={value}
          onChange={onChange}
          onValueChange={(next) => {
            onValueChange(next)
            setValue(next)
          }}
        />
      )
    }

    render(<ControlledSearch />)

    await user.type(screen.getByRole('searchbox', { name: 'Cari' }), 'abc')

    expect(onChange).toHaveBeenCalledTimes(3)
    expect(onValueChange).toHaveBeenLastCalledWith('abc')
  })

  it('activates clickable table rows with Enter and Space without hijacking controls', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    const columns: ColumnDef<{ id: string; name: string }, unknown>[] = [
      { accessorKey: 'name', header: 'Nama' },
      {
        id: 'action',
        header: 'Aksi',
        cell: () => <button type="button">Aksi</button>,
      },
    ]

    render(
      <DataTable
        columns={columns}
        data={[{ id: '1', name: 'Satu' }]}
        getRowId={(row) => row.id}
        onRowClick={onRowClick}
      />,
    )

    const row = screen.getByRole('row', { name: /Satu/ })
    row.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(onRowClick).toHaveBeenCalledTimes(2)

    await user.click(screen.getAllByRole('button', { name: 'Aksi' })[0]!)
    expect(onRowClick).toHaveBeenCalledTimes(2)
  })

  it('uses unique accessible reason ids for multiple confirmation dialogs', () => {
    render(
      <>
        <ConfirmDialog
          open
          onOpenChange={vi.fn()}
          title="Konfirmasi satu"
          requireReason
          onConfirm={vi.fn()}
        />
        <ConfirmDialog
          open
          onOpenChange={vi.fn()}
          title="Konfirmasi dua"
          requireReason
          onConfirm={vi.fn()}
        />
      </>,
    )

    // Radix keeps only the top-most modal in the accessibility tree when multiple
    // dialogs are open; inspect the rendered controls directly to verify IDs.
    const reasons = document.querySelectorAll('textarea')
    expect(reasons).toHaveLength(2)
    expect(reasons[0]?.id).not.toBe(reasons[1]?.id)
    const labels = document.querySelectorAll('label[for]')
    expect([...labels].map((label) => label.htmlFor)).toEqual(expect.arrayContaining([reasons[0]!.id, reasons[1]!.id]))
  })

  it('does not activate a table row when clicking an interactive descendant', () => {
    const onRowClick = vi.fn()
    const columns: ColumnDef<{ id: string; name: string }, unknown>[] = [
      { accessorKey: 'name', header: 'Nama' },
      {
        id: 'action',
        header: 'Aksi',
        cell: () => <a href="/detail">Detail</a>,
      },
    ]

    render(
      <DataTable
        columns={columns}
        data={[{ id: '1', name: 'Satu' }]}
        getRowId={(row) => row.id}
        onRowClick={onRowClick}
      />,
    )

    fireEvent.click(screen.getAllByRole('link', { name: 'Detail' })[0]!)
    expect(onRowClick).not.toHaveBeenCalled()
  })
})
