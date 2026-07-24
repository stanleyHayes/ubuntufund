import { useState } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import InputAdornment from '@mui/material/InputAdornment'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import { CampaignCategory } from '@ubuntu-fund/types'

interface FormData {
  title: string
  description: string
  goalAmount: string
  currency: string
  category: CampaignCategory | ''
  endDate: string
}

interface FormErrors {
  title?: string
  description?: string
  goalAmount?: string
  category?: string
  endDate?: string
}

const CATEGORIES = Object.values(CampaignCategory).map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' '),
}))

export function CampaignForm() {
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    goalAmount: '',
    currency: 'GHS',
    category: '',
    endDate: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)

  function validate(): FormErrors {
    const newErrors: FormErrors = {}
    if (!formData.title.trim()) newErrors.title = 'Title is required'
    else if (formData.title.length < 5) newErrors.title = 'Title must be at least 5 characters'
    if (!formData.description.trim()) newErrors.description = 'Description is required'
    else if (formData.description.length < 20) newErrors.description = 'Description must be at least 20 characters'
    if (!formData.goalAmount) newErrors.goalAmount = 'Goal amount is required'
    else if (Number(formData.goalAmount) <= 0) newErrors.goalAmount = 'Goal amount must be positive'
    if (!formData.category) newErrors.category = 'Category is required'
    if (!formData.endDate) newErrors.endDate = 'End date is required'
    else if (new Date(formData.endDate) <= new Date()) newErrors.endDate = 'End date must be in the future'
    return newErrors
  }

  function handleChange(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }))
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }))
      }
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const newErrors = validate()
    setErrors(newErrors)
    if (Object.keys(newErrors).length === 0) {
      // In a real app, this would call an API
      setSubmitted(true)
    }
  }

  if (submitted) {
    return (
      <Alert severity="success" sx={{ mt: 2 }}>
        Campaign created successfully! (This is a mock -- no data was saved.)
      </Alert>
    )
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <TextField
        label="Campaign Title"
        value={formData.title}
        onChange={handleChange('title')}
        error={!!errors.title}
        helperText={errors.title}
        fullWidth
        required
      />

      <TextField
        label="Description"
        value={formData.description}
        onChange={handleChange('description')}
        error={!!errors.description}
        helperText={errors.description}
        multiline
        rows={5}
        fullWidth
        required
      />

      <TextField
        label="Goal Amount"
        type="number"
        value={formData.goalAmount}
        onChange={handleChange('goalAmount')}
        error={!!errors.goalAmount}
        helperText={errors.goalAmount}
        fullWidth
        required
        slotProps={{
          htmlInput: { min: 1 },
          input: { startAdornment: <InputAdornment position="start">GHS</InputAdornment> },
        }}
      />

      <TextField
        label="Category"
        select
        value={formData.category}
        onChange={handleChange('category')}
        error={!!errors.category}
        helperText={errors.category}
        fullWidth
        required
      >
        <MenuItem value="" disabled>
          Select a category
        </MenuItem>
        {CATEGORIES.map((cat) => (
          <MenuItem key={cat.value} value={cat.value}>
            {cat.label}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        label="End Date"
        type="date"
        value={formData.endDate}
        onChange={handleChange('endDate')}
        error={!!errors.endDate}
        helperText={errors.endDate}
        fullWidth
        required
        slotProps={{ inputLabel: { shrink: true } }}
      />

      <Button type="submit" variant="contained" color="primary" size="large">
        Create Campaign
      </Button>
    </Box>
  )
}
