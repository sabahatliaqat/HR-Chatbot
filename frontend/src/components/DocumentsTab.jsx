import { useEffect, useRef, useState } from 'react'
import StatCard from './StatCard'
import ConfirmModal from './ConfirmModal'
import { uploadFiles, resetDocuments, getIndexedDocuments, deleteDocument, getAnalyticsSummary } from '../lib/apiClient'

// Matches backend/upload_routes.py ALLOWED_EXTENSIONS exactly — Stitch's
// original draft said "PDF, DOCX, TXT" which the backend doesn't actually
// support, so this is corrected to what really works.
const ACCEPTED_EXTENSIONS = ['.pdf', '.md', '.png', '.jpg', '.jpeg']
const ACCEPTED_ATTR = ACCEPTED_EXTENSIONS.join(',')

function fileIcon(filename) {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  if (ext === '.pdf') return { icon: 'picture_as_pdf', bg: 'bg-red-100', color: 'text-red-600' }
  if (ext === '.md') return { icon: 'description', bg: 'bg-blue-100', color: 'text-blue-600' }
  return { icon: 'image', bg: 'bg-purple-100', color: 'text-purple-600' } // png/jpg/jpeg
}

function formatSize(sizeKb) {
  if (sizeKb == null) return '—'
  if (sizeKb >= 1024) return `${(sizeKb / 1024).toFixed(1)} MB`
  return `${sizeKb} KB`
}

function formatDate(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const PAGE_SIZE = 8

export default function DocumentsTab() {
  const [files, setFiles] = useState([]) // indexed filenames from the backend
  const [totalChunks, setTotalChunks] = useState(null)
  const [totalQuestions, setTotalQuestions] = useState(null)
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [fileToDelete, setFileToDelete] = useState(null) // filename pending delete-confirmation
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef(null)

  async function refreshFiles() {
    try {
      const result = await getIndexedDocuments()
      setFiles(result.indexed_files || [])
      setTotalChunks(typeof result.total_chunks === 'number' ? result.total_chunks : null)
    } catch {
      setUploadError("Couldn't load the document list from the backend.")
    } finally {
      setLoadingFiles(false)
    }
  }

  useEffect(() => {
    refreshFiles()
    getAnalyticsSummary()
      .then((s) => setTotalQuestions(s.total_questions))
      .catch(() => {}) // non-critical — stat just stays at 0
  }, [])

  async function handleFilesSelected(selectedFiles) {
    if (!selectedFiles || selectedFiles.length === 0) return
    setUploading(true)
    setUploadError('')
    try {
      await uploadFiles(selectedFiles)
      await refreshFiles()
    } catch (err) {
      setUploadError(err.message || "Upload failed. Make sure the backend is running.")
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragOver(false)
    handleFilesSelected(e.dataTransfer.files)
  }

  async function handleConfirmDelete() {
    if (!fileToDelete) return
    setDeleting(true)
    try {
      await deleteDocument(fileToDelete)
      await refreshFiles()
      setFileToDelete(null)
    } catch {
      setUploadError(`Couldn't delete ${fileToDelete}. Make sure the backend is running.`)
    } finally {
      setDeleting(false)
    }
  }

  async function handleConfirmReset() {
    setResetting(true)
    try {
      await resetDocuments()
      await refreshFiles()
      setResetModalOpen(false)
    } catch {
      setUploadError('Reset failed. Make sure the backend is running.')
    } finally {
      setResetting(false)
    }
  }

  const filtered = files.filter((f) => f.filename.toLowerCase().includes(search.toLowerCase()))
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex flex-col gap-xl">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Document Hub</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Manage and index HR knowledge base files.
          </p>
        </div>
        <button
          onClick={() => setResetModalOpen(true)}
          disabled={files.length === 0}
          className="flex items-center gap-2 px-6 py-3 rounded-full border-2 border-error text-error hover:bg-error-container hover:text-on-error-container transition-all duration-250 font-label-md text-label-md disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <span className="material-symbols-outlined">delete_sweep</span>
          Reset All Documents
        </button>
      </header>

      {uploadError && (
        <p className="text-error text-[13px] -mt-4">{uploadError}</p>
      )}

      {/* Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <StatCard
          label="Total Documents"
          icon="folder_open"
          iconBg="bg-primary-container text-primary"
          value={files.length}
        />
        <StatCard
          label="Chunks Indexed"
          icon="dataset"
          iconBg="bg-secondary-container text-on-secondary-container"
          value={totalChunks ?? 0}
        />
        <StatCard
          label="Questions Answered"
          icon="forum"
          iconBg="bg-surface-variant text-on-surface-variant"
          value={totalQuestions ?? 0}
        />
      </section>

      {/* Upload + list */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl">
        {/* Upload zone */}
        <section className="lg:col-span-4 flex flex-col gap-4">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Add Documents</h2>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-xl flex flex-col items-center justify-center text-center bg-surface-container-lowest transition-all duration-300 cursor-pointer h-full min-h-[300px] ${
              isDragOver ? 'border-primary bg-primary-container/5' : 'border-outline-variant hover:border-primary'
            }`}
          >
            <div className="w-20 h-20 rounded-full bg-primary-container/20 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[40px] text-primary">
                {uploading ? 'hourglass_top' : 'cloud_upload'}
              </span>
            </div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">
              {uploading ? 'Uploading & indexing…' : 'Drag & Drop Files Here'}
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant mb-6 max-w-[250px]">
              Supported formats: PDF, MD, PNG, JPG, JPEG
            </p>
            <button
              type="button"
              disabled={uploading}
              className="arcana-gradient-bg text-on-primary px-6 py-3 rounded-full font-label-md text-label-md shadow-[0_8px_16px_-4px_rgba(138,63,252,0.4)] hover:-translate-y-[2px] transition-all duration-250 disabled:opacity-60"
            >
              Browse Files
            </button>
            <input
              ref={fileInputRef}
              accept={ACCEPTED_ATTR}
              className="hidden"
              multiple
              type="file"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
          </div>
        </section>

        {/* Document list */}
        <section className="lg:col-span-8 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Indexed Documents</h2>
            <div className="relative w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
                search
              </span>
              <input
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-full pl-10 pr-4 py-2 font-body-md focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-250 outline-none"
                placeholder="Search files..."
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-surface-variant/50 overflow-hidden arcana-glow">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-surface-variant">
                    <th className="py-4 px-6 font-label-md text-label-md text-on-surface-variant w-[40%]">Filename</th>
                    <th className="py-4 px-6 font-label-md text-label-md text-on-surface-variant">Upload Date</th>
                    <th className="py-4 px-6 font-label-md text-label-md text-on-surface-variant">Status</th>
                    <th className="py-4 px-6 font-label-md text-label-md text-on-surface-variant text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="font-body-md text-on-surface divide-y divide-surface-variant">
                  {loadingFiles ? (
                    <tr>
                      <td colSpan={4} className="py-8 px-6 text-center text-on-surface-variant">Loading…</td>
                    </tr>
                  ) : pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 px-6 text-center text-on-surface-variant">
                        {files.length === 0 ? 'No documents indexed yet.' : 'No files match your search.'}
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((doc) => {
                      const { icon, bg, color } = fileIcon(doc.filename)
                      return (
                        <tr key={doc.filename} className="hover:bg-surface-container-low/50 transition-colors duration-150">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg} ${color}`}>
                                <span className="material-symbols-outlined">{icon}</span>
                              </div>
                              <div>
                                <p className="font-medium">{doc.filename}</p>
                                <p className="text-sm text-outline">{formatSize(doc.size_kb)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-on-surface-variant">{formatDate(doc.uploaded_at)}</td>
                          <td className="py-4 px-6">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-800 font-label-md text-[12px]">
                              <span className="w-2 h-2 rounded-full bg-green-500" />
                              {doc.status}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => setFileToDelete(doc.filename)}
                              aria-label={`Delete ${doc.filename}`}
                              className="p-2 text-outline hover:text-error hover:bg-error-container/50 rounded-full transition-colors duration-150"
                            >
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-surface-container-lowest border-t border-surface-variant p-4 flex justify-between items-center">
              <span className="text-sm text-outline">
                {filtered.length === 0
                  ? 'No documents'
                  : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-full border border-outline-variant text-outline hover:bg-surface-variant disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-full border border-outline-variant text-on-surface hover:bg-surface-variant disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <ConfirmModal
        open={resetModalOpen}
        title="Reset All Documents?"
        description="This will permanently delete all indexed documents and clear the vector database. This cannot be undone."
        confirmLabel="Yes, Reset Everything"
        onConfirm={handleConfirmReset}
        onCancel={() => setResetModalOpen(false)}
        loading={resetting}
      />

      <ConfirmModal
        open={!!fileToDelete}
        title="Delete this document?"
        description={fileToDelete ? `"${fileToDelete}" and its indexed chunks will be permanently removed. This cannot be undone.` : ''}
        confirmLabel="Yes, Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setFileToDelete(null)}
        loading={deleting}
      />
    </div>
  )
}
