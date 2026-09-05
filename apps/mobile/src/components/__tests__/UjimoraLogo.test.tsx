import React from 'react'
import { render } from '@testing-library/react-native'
import { UjimoraLogo } from '../UjimoraLogo'

describe('UjimoraLogo', () => {
  it('renders without crashing', () => {
    const { root } = render(<UjimoraLogo />)
    expect(root).toBeTruthy()
  })

  it('renders with custom size', () => {
    const { root } = render(<UjimoraLogo size={128} />)
    expect(root).toBeTruthy()
  })
})
