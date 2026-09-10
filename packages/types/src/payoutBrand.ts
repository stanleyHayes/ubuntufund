/** Provider-inspired account artwork. These are saved destinations, not issued payment cards. */
export function payoutAccountBrand(code: string, institutionName?: string) {
  const key = `${code} ${institutionName ?? ''}`.toLowerCase()
  const brands = [
    { match: /mtn/, label: 'MTN MoMo', mark: 'MTN', background: '#FFCC00', foreground: '#172019' },
    {
      match: /vod|telecel/,
      label: 'Telecel Cash',
      mark: 'telecel',
      background: '#C8102E',
      foreground: '#FFFFFF',
    },
    {
      match: /atl|airtel|tigo|^at\s/,
      label: 'AT Money',
      mark: 'AT',
      background: '#095AA6',
      foreground: '#FFFFFF',
    },
    {
      match: /ecobank/,
      label: 'Ecobank',
      mark: 'eco',
      background: '#006B8F',
      foreground: '#FFFFFF',
    },
    { match: /absa/, label: 'Absa', mark: 'absa', background: '#A50034', foreground: '#FFFFFF' },
    {
      match: /stanbic/,
      label: 'Stanbic',
      mark: 'SB',
      background: '#003DA5',
      foreground: '#FFFFFF',
    },
    {
      match: /fidelity/,
      label: 'Fidelity',
      mark: 'F',
      background: '#E87919',
      foreground: '#201508',
    },
    { match: /gcb/, label: 'GCB Bank', mark: 'GCB', background: '#C7A24A', foreground: '#211A0A' },
    { match: /zenith/, label: 'Zenith', mark: 'Z', background: '#B61D22', foreground: '#FFFFFF' },
    { match: /\buba\b/, label: 'UBA', mark: 'UBA', background: '#BA1422', foreground: '#FFFFFF' },
    {
      match: /access/,
      label: 'Access Bank',
      mark: 'A',
      background: '#07539B',
      foreground: '#FFFFFF',
    },
  ]
  return (
    brands.find((b) => b.match.test(key)) ?? {
      label: institutionName || code,
      mark: 'U',
      background: '#2E3D2F',
      foreground: '#F5F2EA',
    }
  )
}

/** Display current provider branding without changing Paystack's routing codes. */
export function payoutInstitutionName(name: string, code = ''): string {
  if (/vodafone|telecel/i.test(name) || /^(vod|vodafone)$/i.test(code)) return 'Telecel Cash'
  return name
}
