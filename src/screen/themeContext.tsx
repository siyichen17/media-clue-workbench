import { createContext, useContext } from 'react'
import { THEMES, type DashPalette } from './theme.ts'

const DashThemeContext = createContext<{ palette: DashPalette; motion: boolean }>({ palette: THEMES['deep-ocean'], motion: true })

export const DashThemeProvider = DashThemeContext.Provider

export function useDashTheme() {
  return useContext(DashThemeContext).palette
}

export function useDashMotion() {
  return useContext(DashThemeContext).motion
}
