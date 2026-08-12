export const roles = ['OWNER', 'MANAGER', 'STAFF'] as const

export type UserRole = (typeof roles)[number]

export type RestaurantMembership = {
  restaurantId: string
  restaurantName: string
  restaurantSlug: string
  role: UserRole
}
