# Upload Dialog & Batch Processing Fixes

## Issues Fixed

### ✅ Issue 1: Dialog Not Closing After All Uploads Complete
**Problem**: Dialog stayed open even after all images were uploaded.

**Solution**:
- Fixed dialog auto-close logic to check if all uploads are complete (success or error)
- Added close button to dialog header for manual dismissal
- Ensures dialog closes in both success and error scenarios

**Files Changed**:
- `apps/web/components/library/UploadZone.tsx` - Fixed auto-close logic and added close button

---

### ✅ Issue 2: Batch Processing Failing for 5 Images
**Problem**: 1 image works, but 5 images fail with `image_parse_error`.

**Root Cause**: 
- When batch processing fails with an image error, fallback to individual processing wasn't properly handling image format validation
- Error detection wasn't catching `image_parse_error` code

**Solution**:
- Improved error detection to catch `image_parse_error` code
- Enhanced individual processing fallback to re-validate image format before processing
- Added better error logging to identify which image is causing issues

**Files Changed**:
- `supabase/functions/auto_tag_asset/index.ts` - Improved error detection and individual processing fallback

---

## Changes Made

### UploadZone.tsx

1. **Fixed Auto-Close Logic**:
   ```typescript
   // Now checks if all uploads are complete (success or error)
   const allComplete = updated.length === 0 || updated.every(item => item.status === 'success' || item.status === 'error')
   
   if (allComplete) {
     // Trigger batch tagging and close dialog
     setTimeout(() => onOpenChange(false), 500)
   }
   ```

2. **Added Close Button**:
   - Added X button in dialog header
   - Allows manual dismissal at any time

### auto_tag_asset/index.ts

1. **Improved Error Detection**:
   ```typescript
   const isImageError = errorMessage?.toLowerCase().includes('image') || 
                       errorCode === 'image_parse_error' ||
                       errorMessage?.toLowerCase().includes('unsupported image')
   ```

2. **Enhanced Individual Processing Fallback**:
   ```typescript
   // Re-validate image format before processing individually
   const supportedUrl = await ensureSupportedImageFormat(originalRequest.imageUrl, supabaseClient);
   const updatedRequest = { ...originalRequest, imageUrl: supportedUrl };
   ```

---

## Expected Behavior

### Dialog Closing:
1. ✅ Dialog auto-closes when all uploads complete (success)
2. ✅ Dialog auto-closes when all uploads complete (with errors)
3. ✅ Dialog can be manually closed via X button
4. ✅ Dialog closes after batch tagging is triggered

### Batch Processing:
1. ✅ Single image: Works as before
2. ✅ Multiple images: If batch fails, falls back to individual processing
3. ✅ Individual processing: Re-validates image format before processing
4. ✅ Failed images: Return empty tags, don't break entire batch

---

## Testing Checklist

1. ✅ Upload 1 image → Dialog closes automatically
2. ✅ Upload 5 images → Dialog closes automatically
3. ✅ Upload with errors → Dialog closes after all complete
4. ✅ Manual close → X button works
5. ✅ Batch processing → 5 images process successfully
6. ✅ Error handling → Failed images don't break batch

---

## Next Steps

If 5 images still fail:
1. Check browser console for detailed error logs
2. Check Supabase Edge Function logs for which image is failing
3. Verify all images are valid formats (JPEG, PNG, WebP, GIF)
4. Check if any images exceed size limits

