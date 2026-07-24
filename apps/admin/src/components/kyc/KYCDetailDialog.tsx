import { Box, Button, DialogActions, DialogContent, DialogTitle, Typography, Divider } from '@mui/material'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import type { KYCVerification } from '@/hooks/useMockData'
import { useAdminPermissions } from '@/context/AdminPermissionContext'
import { Resource, Action } from '@ubuntu-fund/types'

const B = 'rgba(255,255,255,0.06)'

const statusColors: Record<string, string> = {
  pending: '#D3A95C',
  in_review: '#74909A',
  approved: '#5E8F72',
  rejected: '#C06B58',
  expired: '#9E9E9E',
}

const riskColors: Record<string, string> = {
  low: '#5E8F72',
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
  onApprove: () => void
  onReject: () => void
  onRequestMore: () => void
}

export function KYCDetailDialog({
  verification,
  onClose,
  onApprove,
  onReject,
  onRequestMore,
}: KYCDetailDialogProps) {
  const { can } = useAdminPermissions()
  const statusColor = statusColors[verification.status] || '#74909A'
  const riskColor = riskColors[verification.riskLevel] || '#74909A'

  return (
    <>
      <DialogTitle sx={{ px: 3, py: 2, borderBottom: `1px solid ${B}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <VerifiedUserIcon sx={{ fontSize: 28, color: statusColor }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
              {verification.userName}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', mt: 0.5 }}>
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
                border: `1px solid ${statusColor}33`,
                px: 1,
                py: 0.25,
              }}
            >
              {verification.status}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 2.5 }}>
        {/* Verification Type and Risk Level */}
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em', mb: 0.5 }}>
                Verification Type
              </Typography>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>
                {typeLabels[verification.verificationType] ?? verification.verificationType}
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em', mb: 0.5 }}>
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
                    border: `1px solid ${riskColor}33`,
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

        <Divider sx={{ borderColor: B, my: 2 }} />

        {/* Documents */}
        <Box sx={{ mb: 2.5 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em', mb: 1.5 }}>
            Documents ({verification.documents.length})
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {verification.documents.map((doc, idx) => (
              <Box
                key={idx}
                sx={{
                  p: 1.5,
                  bgcolor: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${B}`,
                  borderRadius: '4px',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff', flex: 1 }}>
                    {doc.type.replace('_', ' ')}
                  </Typography>
                  {doc.verifiedAt && (
                    <Typography sx={{ fontSize: '0.65rem', color: '#5E8F72', fontWeight: 600 }}>
                      VERIFIED
                    </Typography>
                  )}
                </Box>
                <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                  Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Divider sx={{ borderColor: B, my: 2 }} />

        {/* Personal Info */}
        {verification.personalInfo && (
          <>
            <Box sx={{ mb: 2.5 }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em', mb: 1.5 }}>
                Personal Information
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                {verification.personalInfo.fullName && (
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', mb: 0.3 }}>
                      Full Name
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: '#fff' }}>
                      {verification.personalInfo.fullName}
                    </Typography>
                  </Box>
                )}
                {verification.personalInfo.nationality && (
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', mb: 0.3 }}>
                      Nationality
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: '#fff' }}>
                      {verification.personalInfo.nationality}
                    </Typography>
                  </Box>
                )}
                {verification.personalInfo.dateOfBirth && (
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', mb: 0.3 }}>
                      Date of Birth
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: '#fff' }}>
                      {new Date(verification.personalInfo.dateOfBirth).toLocaleDateString()}
                    </Typography>
                  </Box>
                )}
                {verification.personalInfo.idNumber && (
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', mb: 0.3 }}>
                      ID Number
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: '#fff' }}>
                      {verification.personalInfo.idNumber}
                    </Typography>
                  </Box>
                )}
              </Box>
              {verification.personalInfo.address && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', mb: 0.3 }}>
                    Address
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: '#fff' }}>
                    {[
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
            <Divider sx={{ borderColor: B, my: 2 }} />
          </>
        )}

        {/* Business Info */}
        {verification.businessInfo && (
          <>
            <Box sx={{ mb: 2.5 }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em', mb: 1.5 }}>
                Business Information
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                {verification.businessInfo.businessName && (
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', mb: 0.3 }}>
                      Business Name
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: '#fff' }}>
                      {verification.businessInfo.businessName}
                    </Typography>
                  </Box>
                )}
                {verification.businessInfo.businessType && (
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', mb: 0.3 }}>
                      Business Type
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: '#fff' }}>
                      {verification.businessInfo.businessType}
                    </Typography>
                  </Box>
                )}
                {verification.businessInfo.registrationNumber && (
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', mb: 0.3 }}>
                      Registration Number
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: '#fff' }}>
                      {verification.businessInfo.registrationNumber}
                    </Typography>
                  </Box>
                )}
                {verification.businessInfo.taxId && (
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', mb: 0.3 }}>
                      Tax ID
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: '#fff' }}>
                      {verification.businessInfo.taxId}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
            <Divider sx={{ borderColor: B, my: 2 }} />
          </>
        )}

        {/* Review Notes */}
        {verification.reviewNotes && (
          <Box sx={{ mb: 2.5 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em', mb: 1 }}>
              Review Notes
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: '#fff', p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', border: `1px solid ${B}`, borderRadius: '4px' }}>
              {verification.reviewNotes}
            </Typography>
          </Box>
        )}

        {verification.rejectionReason && (
          <Box sx={{ mb: 2.5 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em', mb: 1 }}>
              Rejection Reason
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: '#C06B58', p: 1.5, bgcolor: 'rgba(192,107,88,0.08)', border: `1px solid rgba(192,107,88,0.2)`, borderRadius: '4px' }}>
              {verification.rejectionReason}
            </Typography>
          </Box>
        )}

        {/* Metadata */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
          <Box>
            <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', mb: 0.3 }}>
              Created
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
              {new Date(verification.createdAt).toLocaleString()}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', mb: 0.3 }}>
              Last Updated
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
              {new Date(verification.updatedAt).toLocaleString()}
            </Typography>
          </Box>
          {verification.reviewedBy && (
            <Box>
              <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', mb: 0.3 }}>
                Reviewed By
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                {verification.reviewedBy}
              </Typography>
            </Box>
          )}
          {verification.expiryDate && (
            <Box>
              <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', mb: 0.3 }}>
                Expires
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                {new Date(verification.expiryDate).toLocaleDateString()}
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${B}`, display: 'flex', gap: 1 }}>
        <Button
          onClick={onClose}
          sx={{
            fontSize: '0.68rem',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'text.secondary',
            borderColor: B,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
          }}
        >
          Close
        </Button>
        {can(Resource.VERIFICATIONS, Action.UPDATE) && verification.status === 'pending' && (
          <>
            <Button
              onClick={onRequestMore}
              variant="outlined"
              sx={{
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
              onClick={onReject}
              variant="outlined"
              sx={{
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
              onClick={onApprove}
              variant="outlined"
              sx={{
                fontSize: '0.68rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#5E8F72',
                borderColor: 'rgba(76,175,80,0.3)',
                '&:hover': { borderColor: '#5E8F72', bgcolor: 'rgba(76,175,80,0.08)' },
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
