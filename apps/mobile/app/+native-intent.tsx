import { resolveNativePath } from '@/navigation/resolvePath'
export function redirectSystemPath({ path }: { path: string; initial: boolean }) { return resolveNativePath(path) }
