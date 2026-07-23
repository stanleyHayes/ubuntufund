import { Redirect } from 'expo-router'

// This tab redirects to the campaign creation screen.
// The actual create form lives at /campaign/create.
export default function CreateTab() {
  return <Redirect href="/campaign/create" />
}
