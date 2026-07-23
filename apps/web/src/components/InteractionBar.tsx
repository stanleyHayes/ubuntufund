import { useCallback, useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'
import BookmarkBorderRounded from '@mui/icons-material/BookmarkBorderRounded'
import BookmarkRounded from '@mui/icons-material/BookmarkRounded'
import ChatBubbleOutlineRounded from '@mui/icons-material/ChatBubbleOutlineRounded'
import FavoriteBorderRounded from '@mui/icons-material/FavoriteBorderRounded'
import FavoriteRounded from '@mui/icons-material/FavoriteRounded'
import ShareRounded from '@mui/icons-material/ShareRounded'
import { keyframes } from '@mui/material/styles'
import { Link } from 'react-router-dom'

// ─── Animations ───────────────────────────────────────────────────────────────

const scaleBounce = keyframes`
  0%   { transform: scale(1); }
  30%  { transform: scale(1.35); }
  60%  { transform: scale(0.9); }
  100% { transform: scale(1); }
`

// ─── Component ────────────────────────────────────────────────────────────────

interface InteractionBarProps {
  likes: number
  comments: number
  shares: number
  campaignId: string
}

export function InteractionBar({
  likes,
  comments,
  shares,
  campaignId,
}: InteractionBarProps) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(likes)
  const [bookmarked, setBookmarked] = useState(false)
  const [shareCount, setShareCount] = useState(shares)
  const [toastOpen, setToastOpen] = useState(false)
  const [animatingLike, setAnimatingLike] = useState(false)
  const [animatingBookmark, setAnimatingBookmark] = useState(false)
  const [animatingShare, setAnimatingShare] = useState(false)

  const handleLike = useCallback(() => {
    setLiked((prev) => {
      setLikeCount((c) => (prev ? c - 1 : c + 1))
      return !prev
    })
    setAnimatingLike(true)
    setTimeout(() => setAnimatingLike(false), 400)
  }, [])

  const handleBookmark = useCallback(() => {
    setBookmarked((prev) => !prev)
    setAnimatingBookmark(true)
    setTimeout(() => setAnimatingBookmark(false), 400)
  }, [])

  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/campaigns/${campaignId}`
    void navigator.clipboard.writeText(url).then(() => {
      setShareCount((c) => c + 1)
      setToastOpen(true)
      setAnimatingShare(true)
      setTimeout(() => setAnimatingShare(false), 400)
    })
  }, [campaignId])

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        {/* Like */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton
            size="small"
            onClick={handleLike}
            aria-label={liked ? 'Unlike' : 'Like'}
            sx={{
              color: liked ? '#E53935' : 'text.secondary',
              animation: animatingLike ? `${scaleBounce} 0.4s ease` : undefined,
              transition: 'color 0.2s',
              '&:hover': { color: '#E53935' },
            }}
          >
            {liked ? (
              <FavoriteRounded fontSize="small" />
            ) : (
              <FavoriteBorderRounded fontSize="small" />
            )}
          </IconButton>
          <Typography
            variant="caption"
            sx={{ color: liked ? '#E53935' : 'text.secondary', fontWeight: 600, minWidth: 16 }}
          >
            {likeCount}
          </Typography>
        </Box>

        {/* Comment */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton
            size="small"
            component={Link}
            to={`/campaigns/${campaignId}#comments`}
            aria-label="Comments"
            sx={{
              color: 'text.secondary',
              transition: 'color 0.2s',
              '&:hover': { color: '#E65100' },
            }}
          >
            <ChatBubbleOutlineRounded fontSize="small" />
          </IconButton>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', fontWeight: 600, minWidth: 16 }}
          >
            {comments}
          </Typography>
        </Box>

        {/* Share */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton
            size="small"
            onClick={handleShare}
            aria-label="Share"
            sx={{
              color: 'text.secondary',
              animation: animatingShare ? `${scaleBounce} 0.4s ease` : undefined,
              transition: 'color 0.2s',
              '&:hover': { color: '#00695C' },
            }}
          >
            <ShareRounded fontSize="small" />
          </IconButton>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', fontWeight: 600, minWidth: 16 }}
          >
            {shareCount}
          </Typography>
        </Box>

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Bookmark */}
        <IconButton
          size="small"
          onClick={handleBookmark}
          aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark'}
          sx={{
            color: bookmarked ? '#F9A825' : 'text.secondary',
            animation: animatingBookmark ? `${scaleBounce} 0.4s ease` : undefined,
            transition: 'color 0.2s',
            '&:hover': { color: '#F9A825' },
          }}
        >
          {bookmarked ? (
            <BookmarkRounded fontSize="small" />
          ) : (
            <BookmarkBorderRounded fontSize="small" />
          )}
        </IconButton>
      </Box>

      <Snackbar
        open={toastOpen}
        autoHideDuration={2500}
        onClose={() => setToastOpen(false)}
        message="Link copied to clipboard!"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  )
}
