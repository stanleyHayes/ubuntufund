import Box from '@mui/material/Box'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
/** Shared safe Markdown renderer for editorial preview and published articles. Raw HTML is never executed. */
export function ArticleMarkdown({ body }: { body: string }) {
  return (
    <Box
      sx={{
        color: 'text.primary',
        fontSize: '1rem',
        lineHeight: 1.85,
        overflowWrap: 'anywhere',
        '& h1,& h2,& h3': { fontFamily: 'Outfit, sans-serif', lineHeight: 1.25, mt: 3 },
        '& a': { color: 'primary.main', textDecorationThickness: '2px' },
        '& img': { maxWidth: '100%', borderRadius: 'var(--shape-card)', height: 'auto' },
        '& blockquote': {
          borderLeft: '3px solid',
          borderColor: 'secondary.main',
          ml: 0,
          pl: 3,
          color: 'text.secondary',
        },
        '& pre': { overflowX: 'auto', p: 2, bgcolor: 'action.hover', borderRadius: 2 },
        '& code': { fontSize: '.9em' },
        '& table': {
          borderCollapse: 'collapse',
          display: 'block',
          overflowX: 'auto',
          maxWidth: '100%',
        },
        '& td,& th': { border: '1px solid', borderColor: 'divider', px: 2, py: 1 },
        '& input[type=checkbox]': { accentColor: 'var(--text-primary)' },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ children, ...props }) => (
            <a {...props} rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </Box>
  )
}
