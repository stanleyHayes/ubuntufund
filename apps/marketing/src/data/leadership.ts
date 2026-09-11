// Profile supplied by Stanley; links checked against his public portfolio.
export const STANLEY_PROFILE = {
  name: 'Stanley Asoku Hayford',
  role: 'Founder & Principal Engineer · NeuroDyne Corp',
  initials: 'SH',
  bio: 'Software engineer building digital products and infrastructure, with a focus on education, community development, and solving practical problems through technology.',
  // A photograph, so JPEG: the PNG original was 410KB for the same pixels and
  // PNG cannot compress a photo. srcSet lets the browser take the 700px file
  // it actually renders instead of the full-size one.
  image: '/images/about/stanley.jpg',
  imageSrcSet:
    '/images/about/stanley-700w.jpg 700w, /images/about/stanley-1400w.jpg 1400w, /images/about/stanley.jpg 1536w',
  website: 'https://www.stanleyhayford.com/',
  companyUrl: 'https://www.neurodyne.dev/',
  socials: [
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/stanley-asoku-hayford/' },
    { label: 'GitHub', href: 'https://github.com/stanleyHayes' },
    { label: 'X', href: 'https://x.com/sa_hayford' },
    { label: 'Instagram', href: 'https://instagram.com/hayford.stanley' },
  ],
}
