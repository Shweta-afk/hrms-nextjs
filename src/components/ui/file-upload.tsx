'use client'

import { useState, useRef } from 'react'
import { Upload, X, FileText, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'

interface FileUploadProps {
  label: string
  category: string
  sub_id: string
  doc_type: string
  accept?: string
  onUpload?: (key: string, url: string, filename: string) => void
  required?: boolean
  currentFile?: string
}

export function FileUpload({
  label,
  category,
  sub_id,
  doc_type,
  accept = '.pdf,.jpg,.jpeg,.png',
  onUpload,
  required = false,
  currentFile,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState<string | null>(currentFile || null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('category', category)
      formData.append('sub_id', sub_id)
      formData.append('doc_type', doc_type)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json()

      if (json.success) {
        setUploaded(json.data.filename)
        onUpload?.(json.data.key, json.data.url, json.data.filename)
        toast.success(`${file.name} uploaded successfully`)
      } else {
        toast.error(json.error)
      }
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <label className={`
      border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center gap-2
      cursor-pointer transition-colors
      ${uploaded ? 'border-kpi-green bg-kpi-green/5' : 'border-border hover:border-primary/50 hover:bg-primary/5'}
    `}>
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />

      {uploading ? (
        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
      ) : uploaded ? (
        <Check className="h-8 w-8 text-kpi-green" />
      ) : (
        <Upload className="h-8 w-8 text-muted-foreground" />
      )}

      <span className="text-sm font-medium text-foreground text-center">
        {label} {required && <span className="text-destructive">*</span>}
      </span>

      {uploading ? (
        <span className="text-xs text-muted-foreground">Uploading...</span>
      ) : uploaded ? (
        <span className="text-xs text-kpi-green truncate max-w-full">{uploaded}</span>
      ) : (
        <span className="text-xs text-muted-foreground">PDF, JPG, PNG up to 5MB</span>
      )}
    </label>
  )
}