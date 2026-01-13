import { StoryViewerContent } from './StoryViewerContent'

interface StoryPageProps {
  params: Promise<{ id: string }>
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { id } = await params
  return <StoryViewerContent linkId={id} />
}

export const dynamic = 'force-dynamic'
