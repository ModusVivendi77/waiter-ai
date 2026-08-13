import { describe, expect, it } from 'vitest'

import { createOrderSchema } from '@/lib/validation/orders'

const validItem = {
  menuItemId: '123e4567-e89b-12d3-a456-426614174000',
  quantity: 2,
  notes: 'No onions',
}

describe('createOrderSchema', () => {
  it('accepts a valid order payload', () => {
    const result = createOrderSchema.safeParse({
      token: 'X7k91Lm',
      items: [validItem],
      customerNote: 'Extra ketchup',
      idempotencyKey: '987e6543-e21b-12d3-a456-426614174000',
    })

    expect(result.success).toBe(true)
  })

  it('rejects an order without a QR token', () => {
    const result = createOrderSchema.safeParse({
      token: '  ',
      items: [validItem],
      idempotencyKey: '987e6543-e21b-12d3-a456-426614174000',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('QR token is required.')
    }
  })

  it('rejects an empty items array', () => {
    const result = createOrderSchema.safeParse({
      token: 'X7k91Lm',
      items: [],
      idempotencyKey: '987e6543-e21b-12d3-a456-426614174000',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Add at least one item to the order.')
    }
  })

  it('rejects zero quantity', () => {
    const result = createOrderSchema.safeParse({
      token: 'X7k91Lm',
      items: [{ menuItemId: validItem.menuItemId, quantity: 0 }],
      idempotencyKey: '987e6543-e21b-12d3-a456-426614174000',
    })

    expect(result.success).toBe(false)
  })

  it('rejects quantity over 50', () => {
    const result = createOrderSchema.safeParse({
      token: 'X7k91Lm',
      items: [{ menuItemId: validItem.menuItemId, quantity: 51 }],
      idempotencyKey: '987e6543-e21b-12d3-a456-426614174000',
    })

    expect(result.success).toBe(false)
  })

  it('rejects non-UUID menu item ids', () => {
    const result = createOrderSchema.safeParse({
      token: 'X7k91Lm',
      items: [{ menuItemId: 'not-a-uuid', quantity: 1 }],
      idempotencyKey: '987e6543-e21b-12d3-a456-426614174000',
    })

    expect(result.success).toBe(false)
  })

  it('rejects a customer note longer than 1000 characters', () => {
    const result = createOrderSchema.safeParse({
      token: 'X7k91Lm',
      items: [validItem],
      customerNote: 'x'.repeat(1001),
      idempotencyKey: '987e6543-e21b-12d3-a456-426614174000',
    })

    expect(result.success).toBe(false)
  })

  it('limits notes to a maximum of 500 characters', () => {
    const result = createOrderSchema.safeParse({
      token: 'X7k91Lm',
      items: [{ ...validItem, notes: 'x'.repeat(501) }],
      idempotencyKey: '987e6543-e21b-12d3-a456-426614174000',
    })

    expect(result.success).toBe(false)
  })

  it('rejects a missing idempotency key', () => {
    const result = createOrderSchema.safeParse({
      token: 'X7k91Lm',
      items: [validItem],
    })

    expect(result.success).toBe(false)
  })

  it('trims whitespace from the token and notes', () => {
    const result = createOrderSchema.safeParse({
      token: '  X7k91Lm  ',
      items: [{ ...validItem, notes: '  no onions  ' }],
      idempotencyKey: '987e6543-e21b-12d3-a456-426614174000',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.token).toBe('X7k91Lm')
      expect(result.data.items[0]?.notes).toBe('no onions')
    }
  })
})