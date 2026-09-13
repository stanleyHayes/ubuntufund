import { useState } from 'react'
import { BrandedTextField } from '@ubuntu-fund/ui'
import { KYCDocumentPreview } from './KYCDocumentPreview'
import { Alert, Box, Button, Checkbox, FormControlLabel, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import type { KYCVerification } from '@/types/api'
import { useAdminPermissions } from '@/context/AdminPermissionContext'
import { Resource, Action } from '@ubuntu-fund/types'

import { raisedSurface, insetSurface } from '@/lib/surfaces'

const statusColors: Record<string, string> = {
  pending: '#D3A95C',
  in_review: '#74909A',
  approved: '#8FAE96',
  rejected: '#C06B58',
  expired: '#9E9E9E',
}

const riskColors: Record<string, string> = {
  low: '#8FAE96',
  medium: '#D3A95C',
  high: '#C06B58',
}

const typeLabels: Record<string, string> = {
  identity: 'Identity',
  address: 'Address',
  business: 'Business',
  political: 'Political',
  media: 'Media',
}

interface KYCDetailDialogProps {
  verification: KYCVerification
  onClose: () => void
  onApprove: (review: { evidenceReviewed: true; reviewNotes: string }) => void
  onReject: () => void
  saving?: boolean
  actionError?: string
  onRequestMore: () => void
}

function KYCDetailDialog({
  verification,
  onClose,
  onApprove,
  onReject,
  onRequestMore,
  saving = false,
  actionError,
}: KYCDetailDialogProps) {
  const { can } = useAdminPermissions()
  const [evidenceReviewed, setEvidenceReviewed] = useState(false)
  const [reviewNotes, setReviewNotes] = useState('')
  const statusColor = statusColors[verification.status] || '#74909A'
  const riskColor = riskColors[verification.riskLevel] || '#74909A'

  return (
    <>
      <DialogTitle sx={{ px: 3, py: 2, boxShadow: 'var(--neu-subtle)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ ...insetSurface, p: 1.25, display: 'flex' }}><VerifiedUserIcon sx={{ fontSize: 24, color: statusColor }} /></Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: 'text.primary' }}>
              {verification.userName}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
              KYC ID: {verification.id}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography
              sx={{
                display: 'inline-block',
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: statusColor,
                letterSpacing: '0.08em',
                ...insetSurface,
                px: 1,
                py: 0.25,
              }}
            >
              {verification.status}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 2.5, overflowWrap: 'anywhere', '&.MuiDialogContent-root': { pt: 3 } }}>
        {/* Verification Type and Risk Level */}
        <Box sx={{ ...raisedSurface, p: 2.5, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: '0.05em', mb: 0.5 }}>
                Verification Type
              </Typography>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'text.primary' }}>
                {typeLabels[verification.verificationType] ?? verification.verificationType}
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: '0.05em', mb: 0.5 }}>
                Risk Level
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {verification.riskLevel === 'high' && <WarningAmberIcon sx={{ fontSize: 18, color: riskColor }} />}
                <Typography
                  sx={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: riskColor,
                    letterSpacing: '0.08em',
                    ...insetSurface,
                    px: 1,
                    py: 0.25,
                  }}
                >
                  {verification.riskLevel} risk
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Documents */}
        <Box sx={{ ...raisedSurface, p: 2.5, mb: 3 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: '0.05em', mb: 1.5 }}>
            Documents ({verification.documents.length})
          </Typography>
          {verification.documents.length === 0 && <Typography variant="body2" color="text.secondary">No document files were submitted. Request any missing evidence before approval; identity verification requires an ID document.</Typography>}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {verification.documents.map((doc, idx) => (
              <Box
                key={`${idx}-${doc.url}`}
                sx={{
                  p: 1.5,

                  ...insetSurface,

                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.primary', flex: 1 }}>
                    {doc.type.replaceAll('_', ' ')} · {idx + 1}
                  </Typography>
                  {doc.verifiedAt && (
                    <Typography sx={{ fontSize: '0.65rem', color: '#8FAE96', fontWeight: 600 }}>
                      VERIFIED
                    </Typography>
                  )}
                </Box>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                  Uploaded: {doc.uploadedAt && !Number.isNaN(new Date(doc.uploadedAt).getTime()) ? new Date(doc.uploadedAt).toLocaleDateString() : 'Date unavailable'}
                </Typography>
                <KYCDocumentPreview url={doc.url} label={`${doc.type.replaceAll('_', ' ')} ${idx + 1}`} />
              </Box>
            ))}
          </Box>
        </Box>

        {/* Personal Info */}
        {verification.personalInfo && (
          <>
            <Box sx={{ ...raisedSurface, p: 2.5, mb: 3 }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: '0.05em', mb: 1.5 }}>
                Personal Information
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
                {verification.personalInfo.fullName && (
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mb: 0.3 }}>
                      Full Name
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                      {verification.personalInfo.fullName}
                    </Typography>
                  </Box>
                )}
                {verification.personalInfo.nationality && (
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mb: 0.3 }}>
                      Nationality
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                      {verification.personalInfo.nationality}
                    </Typography>
                  </Box>
                )}
                {verification.personalInfo.dateOfBirth && (
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mb: 0.3 }}>
                      Date of Birth
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                      {new Date(verification.personalInfo.dateOfBirth).toLocaleDateString()}
                    </Typography>
                  </Box>
                )}
                {verification.personalInfo.idNumber && (
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mb: 0.3 }}>
                      ID Number
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                      {verification.personalInfo.idNumber}
                    </Typography>
                  </Box>
                )}
              </Box>
              {verification.personalInfo.address && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mb: 0.3 }}>
                    Address
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                    {[
                      verification.personalInfo.address.gpsAddress && `GhanaPost GPS: ${verification.personalInfo.address.gpsAddress}`,
                      verification.personalInfo.address.street,
                      verification.personalInfo.address.city,
                      verification.personalInfo.address.state,
                      verification.personalInfo.address.country,
                      verification.personalInfo.address.postalCode,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </Typography>
                </Box>
              )}
            </Box>
          </>
        )}

        {/* Business Info */}
        {verification.businessInfo && (
          <>
            <Box sx={{ ...raisedSurface, p: 2.5, mb: 3 }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: '0.05em', mb: 1.5 }}>
                Business Information
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
                {verification.businessInfo.businessName && (
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mb: 0.3 }}>
                      Business Name
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                      {verification.businessInfo.businessName}
                    </Typography>
                  </Box>
                )}
                {verification.businessInfo.businessType && (
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mb: 0.3 }}>
                      Business Type
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                      {verification.businessInfo.businessType}
                    </Typography>
                  </Box>
                )}
                {verification.businessInfo.registrationNumber && (
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mb: 0.3 }}>
                      Registration Number
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                      {verification.businessInfo.registrationNumber}
                    </Typography>
                  </Box>
                )}
                {verification.businessInfo.taxId && (
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mb: 0.3 }}>
                      Tax ID
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                      {verification.businessInfo.taxId}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </>
        )}

        {verification.businessInfo && (
          <Box sx={{ ...raisedSurface, p: 2.5, mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Organization authority and control</Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Registered address: {verification.businessInfo.registeredAddress
                ? [verification.businessInfo.registeredAddress.street, verification.businessInfo.registeredAddress.city, verification.businessInfo.registeredAddress.state, verification.businessInfo.registeredAddress.country, verification.businessInfo.registeredAddress.postalCode, verification.businessInfo.registeredAddress.gpsAddress].filter(Boolean).join(', ')
                : 'Not provided'}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>Representative capacity: {verification.businessInfo.representativeCapacity || 'Not provided'}</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 1 }}>Ownership and control: {verification.businessInfo.ownershipExplanation || 'Not provided'}</Typography>
            {verification.businessInfo.controlPersons?.length ? verification.businessInfo.controlPersons.map((person, index) => (
              <Typography key={index} variant="body2" sx={{ mb: 1 }}>
                {person.fullName} · {person.role.replaceAll('_', ' ')} · {person.country}
                {person.ownershipPercent !== undefined ? ` · ${person.ownershipPercent}% ownership` : ''}
              </Typography>
            )) : <Typography variant="body2">No controlling persons declared.</Typography>}
            <Typography variant="body2" sx={{ mt: 1 }}>
              Applicant declarations: authority {verification.businessInfo.declaration?.authorized ? 'confirmed' : 'not confirmed'}; accuracy {verification.businessInfo.declaration?.accurate ? 'confirmed' : 'not confirmed'}.
              {verification.businessInfo.declaration?.acceptedAt && ` Recorded ${new Date(verification.businessInfo.declaration.acceptedAt).toLocaleString()}.`}
            </Typography>
            <Typography variant="caption" color="text.secondary">These are applicant declarations. Review the supporting private documents before making a decision.</Typography>
          </Box>
        )}

        {/* Review Notes */}
        {verification.reviewNotes && (
          <Box sx={{ ...raisedSurface, p: 2.5, mb: 3 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: '0.05em', mb: 1 }}>
              Review Notes
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: 'text.primary', p: 1.5,  ...insetSurface,  }}>
              {verification.reviewNotes}
            </Typography>
          </Box>
        )}

        {verification.rejectionReason && (
          <Box sx={{ ...raisedSurface, p: 2.5, mb: 3 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: '0.05em', mb: 1 }}>
              Rejection Reason
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: '#C06B58', p: 1.5, ...insetSurface,  }}>
              {verification.rejectionReason}
            </Typography>
          </Box>
        )}

        {/* Metadata */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5, fontSize: '0.75rem', color: 'text.secondary' }}>
          <Box>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mb: 0.3 }}>
              Created
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
              {new Date(verification.createdAt).toLocaleString()}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mb: 0.3 }}>
              Last Updated
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
              {new Date(verification.updatedAt).toLocaleString()}
            </Typography>
          </Box>
          {verification.reviewedBy && (
            <Box>
              <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mb: 0.3 }}>
                Reviewed By
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                {verification.reviewedBy}
              </Typography>
            </Box>
          )}
          {verification.expiryDate && (
            <Box>
              <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mb: 0.3 }}>
                Expires
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                {new Date(verification.expiryDate).toLocaleDateString()}
              </Typography>
            </Box>
          )}
        </Box>
        {!!verification.informationRequests?.length && <Box sx={{ mt: 3 }}>
          <Typography variant="h6">Information request history</Typography>
          {verification.informationRequests.map(item => <Box key={item.id} sx={{ mt: 2, p: 2, ...insetSurface }}>
            <Typography sx={{ fontWeight: 700 }}>Requested {new Date(item.requestedAt).toLocaleString()}</Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap' }}>{item.prompt}</Typography>
            {item.respondedAt ? <>
              <Typography sx={{ mt: 1, fontWeight: 700 }}>Applicant response · {new Date(item.respondedAt).toLocaleString()}</Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>{item.response}</Typography>
            </> : <Typography sx={{ mt: 1 }}>Awaiting applicant response</Typography>}
          </Box>)}
        </Box>}
        {can(Resource.VERIFICATIONS, Action.UPDATE) && ['pending', 'in_review'].includes(verification.status) && <Box sx={{ mt: 3 }}>
          <BrandedTextField fullWidth multiline minRows={3} label="Internal review findings" value={reviewNotes} disabled={saving} onChange={event => setReviewNotes(event.target.value)} inputProps={{ maxLength: 2000 }} helperText="Record what you checked and how the evidence supports approval (at least 20 characters). Do not duplicate full ID numbers or document contents." />
          <FormControlLabel control={<Checkbox checked={evidenceReviewed} disabled={saving} onChange={event => setEvidenceReviewed(event.target.checked)} />} label="I reviewed the application, its documents and applicant responses, and the evidence supports approval." />
        </Box>}
      </DialogContent>

      {actionError && <Alert severity="error" sx={{ mx: 3 }}>{actionError}</Alert>}
      <DialogActions sx={{ px: 3, py: 2, boxShadow: 'var(--neu-subtle)', display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Button
          onClick={onClose}
          sx={{
            mr: 'auto',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            fontSize: '0.68rem',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'text.secondary',

            '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
          }}
        >
          Close
        </Button>
        {can(Resource.VERIFICATIONS, Action.UPDATE) && ['pending', 'in_review'].includes(verification.status) && (
          <>
            <Button
              disabled={saving || verification.informationRequests?.some(item => !item.respondedAt)}
              onClick={onRequestMore}
              variant="outlined"
              sx={{
                flexShrink: 0,
                whiteSpace: 'nowrap',
                fontSize: '0.68rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#74909A',
                borderColor: 'rgba(116,144,154,0.3)',
                '&:hover': { borderColor: '#74909A', bgcolor: 'rgba(116,144,154,0.08)' },
              }}
            >
              Request More
            </Button>
            <Button
              disabled={saving}
              onClick={onReject}
              variant="outlined"
              sx={{
                flexShrink: 0,
                whiteSpace: 'nowrap',
                fontSize: '0.68rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#C06B58',
                borderColor: 'rgba(192,107,88,0.3)',
                '&:hover': { borderColor: '#C06B58', bgcolor: 'rgba(192,107,88,0.08)' },
              }}
            >
              Reject
            </Button>
            <Button
              disabled={saving || !evidenceReviewed || reviewNotes.trim().length < 20 || verification.informationRequests?.some(item => !item.respondedAt)}
              onClick={() => onApprove({ evidenceReviewed: true, reviewNotes: reviewNotes.trim() })}
              variant="outlined"
              sx={{
                flexShrink: 0,
                whiteSpace: 'nowrap',
                fontSize: '0.68rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#8FAE96',
                borderColor: 'rgba(76,175,80,0.3)',
                '&:hover': { borderColor: '#8FAE96', bgcolor: 'rgba(76,175,80,0.08)' },
              }}
            >
              Approve
            </Button>
          </>
        )}
      </DialogActions>
    </>
  )
}

export default KYCDetailDialog
