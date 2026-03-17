import { render, screen } from '@testing-library/react'
import { DownloadCard } from './download-card'

describe('DownloadCard', () => {
  it('renders progress details and a cancel action for active downloads', () => {
    render(
      <DownloadCard
        busy={false}
        onCancel={() => undefined}
        item={{
          id: 'download-1',
          userId: 'user-1',
          url: 'https://example.com/watch?v=abc123',
          title: 'Example clip',
          thumbnail: null,
          formatId: '137+140',
          ext: 'mp4',
          sourceExt: 'mp4',
          hasVideo: true,
          hasAudio: true,
          outputPath: null,
          status: 'downloading',
          progress: {
            downloadedBytes: 512,
            totalBytes: 1024,
            speed: 256,
            eta: 5,
            percentage: 50,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: null,
          error: null,
        }}
      />
    )

    expect(screen.getByText('Example clip')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(screen.getByText(/50%/i)).toBeInTheDocument()
  })
})
