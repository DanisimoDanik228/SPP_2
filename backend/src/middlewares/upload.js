import crypto from 'node:crypto'
import fs from 'node:fs'
import multer from 'multer'
import { uploadsDir } from '../db.js'
import {
  isAllowedImage,
  MAX_IMAGE_SIZE_BYTES,
  pathExtension,
} from '../utils/validation.js'

export class ImageValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ImageValidationError'
  }
}

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, callback) => {
    const extension = pathExtension(file.originalname)
    const fileName = `${crypto.randomUUID()}${extension}`
    callback(null, fileName)
  },
})

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!isAllowedImage(file.originalname, file.mimetype)) {
      callback(
        new ImageValidationError(
          'Only JPG, JPEG, PNG, GIF and WEBP images are allowed.',
        ),
      )
      return
    }
    callback(null, true)
  },
})

export const uploadSingleImage = upload.single('image')

export function discardUpload(file) {
  if (!file) {
    return
  }
  fs.unlink(file.path, () => {})
}