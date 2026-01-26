# Supabase Storage Setup

## Creating the Submissions Bucket

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket**
4. Configure the bucket:
   - **Name**: `submissions`
   - **Public bucket**: ✓ (checked) - Allows public read access to uploaded files
   - Click **Create bucket**

## Setting Bucket Policies

After creating the bucket, set up the following policies:

### 1. Allow Authenticated Users to Upload

```sql
-- Policy: Allow authenticated users to upload files to their own folders
CREATE POLICY "Users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'submissions' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### 2. Allow Public Read Access

```sql
-- Policy: Allow public read access to all files
CREATE POLICY "Public can read all files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'submissions');
```

### 3. Allow Users to Update Their Own Files

```sql
-- Policy: Allow users to update their own files
CREATE POLICY "Users can update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'submissions' AND
  auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'submissions' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### 4. Allow Users to Delete Their Own Files

```sql
-- Policy: Allow users to delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'submissions' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

## File Structure

Files are organized in the following structure:

```
submissions/
  └── {userId}/
      └── {submissionId}/
          └── {questionId}/
              └── {timestamp}-{filename}
```

Example:
```
submissions/
  └── a1b2c3d4-e5f6-7890-abcd-ef1234567890/
      └── x9y8z7w6-v5u4-3210-zyxw-vu9876543210/
          └── q1w2e3r4-t5y6-7890-qwer-ty1234567890/
              └── 1706284800000-diagram.png
```

## File Type Restrictions

The API enforces the following restrictions:

- **Allowed extensions**: `.png`, `.jpg`, `.jpeg`, `.svg`, `.puml`
- **Allowed MIME types**: `image/png`, `image/jpeg`, `image/svg+xml`, `text/plain`
- **Maximum file size**: 5 MB

## Testing

To test the storage setup:

1. Ensure you're authenticated in the application
2. Navigate to a UML question in an assignment
3. Click the "Upload Diagram" tab
4. Drag and drop a file or click to select
5. The file should upload and display a preview
6. Check the Supabase Storage dashboard to verify the file was uploaded

## Troubleshooting

### Upload fails with 403 Forbidden
- Check that the bucket policies are correctly set up
- Verify the user is authenticated
- Ensure the user ID in the file path matches the authenticated user

### Files not visible after upload
- Verify the bucket is set to **Public**
- Check that the "Public can read all files" policy is active
- Try generating a signed URL for the file

### File size errors
- Check that the file is under 5 MB
- Client-side validation should catch this before upload
- Server-side validation will also reject oversized files

## Security Considerations

- Files are organized by user ID to prevent unauthorized access
- Only authenticated users can upload files
- Users can only upload to folders matching their user ID
- Public read access allows viewing uploaded diagrams
- Consider implementing file scanning for malware in production
- Set up periodic cleanup of abandoned submissions
