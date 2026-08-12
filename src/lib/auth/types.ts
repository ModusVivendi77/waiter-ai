export const roles = ['OWNER', 'MANAGER', 'STAFF'] as const
export const platformRoles = ['SUPER_ADMIN'] as const

export type UserRole = (typeof roles)[number]
export type PlatformRole = (typeof platformRoles)[number]

export type RestaurantMembership = {
  restaurantId: string
  restaurantName: string
  restaurantSlug: string
  role: UserRole
}
