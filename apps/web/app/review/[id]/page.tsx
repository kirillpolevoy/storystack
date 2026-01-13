import { ReviewPageContent } from './ReviewPageContent'

interface ReviewPageProps {
  params: Promise<{ id: string }>
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { id } = await params
  return <ReviewPageContent linkId={id} />
}

export const dynamic = 'force-dynamic'
