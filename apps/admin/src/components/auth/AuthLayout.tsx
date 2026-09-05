import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import './auth.css'

export default function AuthLayout({ children, recovery = false }: { children: ReactNode; recovery?: boolean }) {
  return (
    <Box className="admin-auth">
      <header className="admin-auth-header">
        <a href="/login" className="admin-auth-brand" aria-label="Ujimora administration sign in">
          <img src="/favicon.svg" alt="" width="40" height="40" />
          <span>Ujimora<small>Administration</small></span>
        </a>
        <span className="admin-auth-header-note">One chain. Many hands.</span>
      </header>
      <main className="admin-auth-main">
        <section className="admin-auth-story" aria-label="Ujimora administration">
          <div className="admin-auth-eyebrow">THE WORK BEHIND THE IMPACT</div>
          <Typography component="h2" className="admin-auth-headline">
            Every cause.<br />Every contribution.<br /><span>In good hands.</span>
          </Typography>
          <p className="admin-auth-description">A considered space to care for campaigns, support communities, and keep giving accountable.</p>
          <div className="admin-auth-art" aria-hidden="true">
            <svg viewBox="0 0 560 240" fill="none">
              <defs>
                <linearGradient id="auth-gold" x1="130" y1="20" x2="360" y2="230" gradientUnits="userSpaceOnUse"><stop stopColor="#F3DEAB" /><stop offset=".48" stopColor="#C7A24A" /><stop offset="1" stopColor="#735F31" /></linearGradient>
                <linearGradient id="auth-sage" x1="290" y1="20" x2="450" y2="220" gradientUnits="userSpaceOnUse"><stop stopColor="#CAD5C2" /><stop offset=".5" stopColor="#8FAE96" /><stop offset="1" stopColor="#3C5846" /></linearGradient>
                <filter id="auth-shadow" x="-50%" y="-50%" width="200%" height="220%"><feDropShadow dx="8" dy="18" stdDeviation="12" floodColor="#080E0B" floodOpacity=".65" /></filter>
              </defs>
              <path d="M20 120h100m300 0h120" stroke="#6F806C" strokeOpacity=".35" strokeDasharray="3 8" />
              <g filter="url(#auth-shadow)">
                <rect x="146" y="47" width="146" height="146" rx="26" transform="rotate(45 219 120)" stroke="url(#auth-gold)" strokeWidth="23" />
                <rect x="266" y="47" width="146" height="146" rx="53" transform="rotate(45 339 120)" stroke="url(#auth-sage)" strokeWidth="23" />
                <path d="M272 67l38 38q15 15 0 30" stroke="url(#auth-gold)" strokeWidth="23" />
              </g>
              <circle cx="34" cy="120" r="4" fill="#C7A24A" /><circle cx="526" cy="120" r="4" fill="#8FAE96" />
            </svg>
            <span>Collective work. Shared responsibility.</span>
          </div>
          <div className="admin-auth-story-footer"><span>Campaign oversight</span><span>Community trust</span><span>Accountable giving</span></div>
        </section>
        <section className="admin-auth-panel" aria-label={recovery ? 'Account recovery' : 'Administrator sign in'}>
          <div className="admin-auth-panel-kicker"><span className="admin-auth-mini-mark" aria-hidden="true">◇</span>{recovery ? 'ACCOUNT RECOVERY' : 'ADMIN WORKSPACE'}</div>
          {children}
        </section>
      </main>
      <footer className="admin-auth-footer"><span>© {new Date().getFullYear()} Ujimora</span><span>For authorized administrators</span></footer>
    </Box>
  )
}
