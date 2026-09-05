import { useId } from 'react'
import Box from '@mui/material/Box'

/** Original vector illustrations: symbolic scenes, not interface mockups. */
export default function ProductIllustration({ screen, dark = false }: {
  screen: 'create' | 'campaign' | 'workspace' | 'explore'
  caption?: string
  dark?: boolean
  eager?: boolean
}) {
  const id = useId().replace(/:/g, '')
  const titles = { create: 'A story taking shape on paper', campaign: 'A small contribution growing into a flourishing tree', workspace: 'Many hands connected by a shared purpose', explore: 'A community of homes, schools, and places to gather' }
  return (
    <Box sx={{ width: '100%', maxWidth: 700, mx: 'auto', color: dark ? '#B5C9BA' : '#526D50' }}>
      <svg viewBox="0 0 640 340" role="img" aria-labelledby={`${id}-title`} style={{ display: 'block', width: '100%', maxHeight: 320, height: 'auto' }}>
        <title id={`${id}-title`}>{titles[screen]}</title>
        <defs>
          <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#E6CF92" /><stop offset="1" stopColor="#B18A3E" /></linearGradient>
          <linearGradient id={`${id}-sage`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#C6D4BC" /><stop offset="1" stopColor="#69866A" /></linearGradient>
          <filter id={`${id}-shadow`} x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#17291D" floodOpacity=".12" /></filter>
        </defs>
        <ellipse cx="320" cy="284" rx="222" ry="22" fill="currentColor" opacity=".09" />
        <circle cx="320" cy="155" r="122" fill="currentColor" opacity=".05" />
        <circle cx="320" cy="155" r="147" stroke="currentColor" opacity=".13" strokeDasharray="3 10" fill="none" />
        <g filter={`url(#${id}-shadow)`} strokeLinejoin="round" strokeLinecap="round">
          {screen === 'create' && <>
            <path d="M170 84l252-23 24 199-252 23z" fill={`url(#${id}-sage)`} />
            <path d="M206 47h183l41 43v174H206z" fill="#F6F0DF" />
            <path d="M389 47v43h41" fill="#DDCFAB" />
            <path d="M239 113h109M239 139h143M239 165h116" stroke="#A9B69D" strokeWidth="8" />
            <path d="M253 213c-24-27-48 6 0 32 49-26 24-59 0-32" fill={`url(#${id}-gold)`} />
            <g transform="rotate(32 410 188)"><path d="M396 99h28v161l-14 25-14-25z" fill={`url(#${id}-gold)`} /><path d="M396 260h28l-14 25z" fill="#354E39" /><path d="M410 111v133" stroke="#F6E6BD" strokeWidth="5" /></g>
            <path d="M145 191c-33-39-50-5-26 23l38 44" stroke="#799377" strokeWidth="10" fill="none" />
          </>}
          {screen === 'campaign' && <>
            <path d="M284 241h86l-13 44h-60z" fill={`url(#${id}-gold)`} />
            <path d="M326 246V96M326 189l-57-42M326 153l55-42" stroke="#587650" strokeWidth="10" fill="none" />
            <path d="M326 144c-64-10-88-62-54-75 39-15 66 26 54 75z" fill={`url(#${id}-sage)`} />
            <path d="M326 193c-72 8-111-28-86-53 30-30 79 4 86 53z" fill="#93AD88" />
            <path d="M330 154c10-66 68-84 85-52 17 34-33 64-85 52z" fill={`url(#${id}-sage)`} />
            <path d="M328 99c-32-45-9-83 13-73 26 13 11 52-13 73z" fill="#C1CEAE" />
            {[0,1,2].map(n=><g key={n}><ellipse cx={207-n*14} cy={263-n*13} rx="29" ry="10" fill={`url(#${id}-gold)`} /><path d={`M${178-n*14} ${263-n*13}v9c0 13 58 13 58 0v-9`} fill="#B59247" /></g>)}
            <path d="M416 236l9-18 9 18 19 8-19 8-9 19-9-19-19-8z" fill="#C7A24A" />
          </>}
          {screen === 'workspace' && <>
            <rect x="210" y="93" width="135" height="135" rx="22" transform="rotate(45 277 160)" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="24" />
            <rect x="295" y="93" width="135" height="135" rx="48" transform="rotate(45 362 160)" fill="none" stroke={`url(#${id}-sage)`} strokeWidth="24" />
            <path d="M322 109l40 39q12 12 0 24" stroke={`url(#${id}-gold)`} strokeWidth="24" fill="none" />
            <path d="M99 209l59-40q16-10 28 4l32 34-23 16-26-16-33 37z" fill="#C18D66" />
            <path d="M541 209l-59-40q-16-10-28 4l-32 34 23 16 26-16 33 37z" fill="#795540" />
            <path d="M98 206l42 39-18 23-45-39z" fill="#93AD88" /><path d="M542 206l-42 39 18 23 45-39z" fill="#C7A24A" />
          </>}
          {screen === 'explore' && <>
            <path d="M110 173l76-61 77 61v99H110z" fill="#DAC6A0" /><path d="M97 175l89-76 90 76" stroke="#9A7155" strokeWidth="18" fill="none" />
            <path d="M164 209h44v63h-44z" fill="#5E785A" />
            <path d="M270 117h124v156H270z" fill="#F4ECD8" /><path d="M255 117l77-56 77 56z" fill={`url(#${id}-sage)`} />
            <path d="M304 227h56v46h-56zM295 142h22v28h-22zM346 142h22v28h-22zM295 184h22v23h-22zM346 184h22v23h-22z" fill="#BDA467" />
            <path d="M417 189h111v84H417z" fill="#B5C5A4" /><path d="M408 189l64-47 67 47z" fill="#C7A24A" /><path d="M456 227h31v46h-31z" fill="#536D4E" />
            <path d="M89 276v-71m0 30c-42-13-36-51-15-43 17 7 19 24 15 43m0-12c34-35 52-1 0 25" stroke="#799377" strokeWidth="7" fill="none" />
          </>}
        </g>
        <g fill="#C7A24A"><circle cx="140" cy="88" r="5" /><circle cx="487" cy="106" r="4" /><path d="M471 60v16m-8-8h16" stroke="#C7A24A" strokeWidth="3" /></g>
      </svg>
    </Box>
  )
}
