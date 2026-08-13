import { z } from 'zod'

export const createOrderSchema = z.object({
  token: z.string().trim().min(3, 'QR token is required.'),
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
        notes: z.string().trim().max(500).optional(),
        modifiers: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
      })
    )
    .min(1, 'Add at least one item to the order.'),
  customerNote: z.string().trim().max(1000).optional(),
  idempotencyKey: z.string().uuid(),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>
