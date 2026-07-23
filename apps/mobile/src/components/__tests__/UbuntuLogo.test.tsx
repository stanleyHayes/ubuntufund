import React from 'react'
import { render } from '@testing-library/react-native'
import { UbuntuLogo } from '../UbuntuLogo'

describe('UbuntuLogo', () => {
  it('renders without crashing', () => {
    const { root } = render(<UbuntuLogo />)
    expect(root).toBeTruthy()
  })

  it('renders with custom size', () => {
    const { root } = render(<UbuntuLogo size={128} />)
    expect(root).toBeTruthy()
  })
})
