export type LifeModuleId =
  | 'jobs'
  | 'vocabulary'
  | 'vault'
  | 'goals'
  | 'finances'
  | 'timeline'
  | 'settings'

export interface LifeModule {
  id: LifeModuleId
  name: string
  iconName: string
  description: string
  badge?: string
  status: 'active' | 'coming_soon'
}
