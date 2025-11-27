# StoryStack App Icon Design Specification

## App Concept
StoryStack is a photo organization app that helps users:
- Organize photos with AI-powered tagging
- Build curated story sequences from photos
- Manage photo campaigns
- Export stories as albums

## Icon Design Concepts

### Option 1: Stacked Photos (Recommended)
**Visual**: 3-4 photos stacked/layered with a slight offset
- Represents "stacking" stories
- Clean, modern, instantly recognizable
- Photos can have rounded corners
- Subtle shadow between layers for depth
- Color: Use your brand gold (#b38f5b) as accent or background

### Option 2: Photo with Tag Badge
**Visual**: A single photo with a tag/label badge overlay
- Represents tagging/organization
- Tag badge in brand gold color
- Clean, minimal design
- Focuses on the tagging feature

### Option 3: Layered Story Cards
**Visual**: Multiple rectangular cards/panels stacked
- Represents story sequences
- Each card slightly offset
- Can show photo previews on cards
- Emphasizes the "story" concept

### Option 4: Camera/Photo with Stack
**Visual**: Camera icon or photo frame with stacked elements
- Combines photo + organization
- Stack elements show organization
- More abstract/iconic approach

## Design Requirements

### Technical Specs
- **Size**: 1024x1024 pixels (exact)
- **Format**: PNG
- **Background**: Solid color (no transparency for iOS)
- **Color Space**: RGB
- **No Text**: Avoid including text in the icon
- **No Rounded Corners**: iOS adds these automatically

### Visual Guidelines
- **Simple & Recognizable**: Should work at small sizes (home screen)
- **Brand Colors**: Use gold (#b38f5b) as primary accent
- **Clean Design**: Apple-style minimalism
- **High Contrast**: Ensure visibility on light/dark backgrounds
- **No Fine Details**: Keep it simple for small sizes

## Recommended Tools

### 1. AI Image Generators
**Midjourney Prompt:**
```
app icon, 1024x1024, stacked photos, photo organization app, 
minimal design, gold accent color #b38f5b, clean modern, 
iOS app icon style, no text, solid background, 
professional, high quality --ar 1:1
```

**DALL-E / ChatGPT Prompt:**
```
Create a 1024x1024 pixel iOS app icon for a photo organization app called StoryStack. 
The icon should show 3-4 photos stacked/layered with slight offset, representing 
photo stories. Use a clean, minimal design with gold (#b38f5b) accent color. 
Solid background, no text, no rounded corners (iOS adds these). 
Modern, professional, Apple-style design.
```

**Stable Diffusion Prompt:**
```
app icon, stacked photographs, photo organization, 
minimalist design, gold accent, iOS style, 
1024x1024, clean, modern, professional
```

### 2. Design Tools
- **Figma**: Free, web-based, great for icon design
- **Sketch**: Mac-only, professional design tool
- **Adobe Illustrator**: Vector-based, can export PNG
- **Canva**: Simple, template-based (has app icon templates)
- **IconKitchen**: Online icon generator (Android only, but can adapt)

### 3. Icon Generator Services
- **AppIcon.co**: Upload design, generates all sizes
- **IconGenerator.app**: Online icon generator
- **MakeAppIcon.com**: Free icon generator

## Quick Creation Steps

### Using AI (Fastest)
1. Use one of the prompts above with Midjourney/DALL-E
2. Generate the icon
3. Download and resize to exactly 1024x1024
4. Ensure solid background (no transparency)
5. Save as PNG
6. Replace `assets/icon.png`

### Using Figma (Professional)
1. Create 1024x1024 frame
2. Design stacked photos icon
3. Use brand gold (#b38f5b) for accents
4. Export as PNG at 1x (1024x1024)
5. Replace `assets/icon.png`

### Using Canva (Easiest)
1. Search "app icon" templates
2. Customize with stacked photos concept
3. Export as PNG
4. Resize to 1024x1024
5. Replace `assets/icon.png`

## Color Palette
- **Primary Gold**: #b38f5b (your brand color)
- **Background**: White or light gray (#fafafa)
- **Accent**: Can use complementary colors if needed

## After Creating the Icon

1. **Save as**: `assets/icon.png` (exactly 1024x1024)
2. **Verify**: Open in Preview, check it's 1024x1024
3. **Rebuild**: Run `npx expo prebuild --clean && npx expo run:ios`
4. **Test**: Install on device to see the new icon

## Example Icon Ideas

### Simple Stacked Photos
```
[Photo 1] ← Top layer, slightly offset right
  [Photo 2] ← Middle layer, slightly offset left  
    [Photo 3] ← Bottom layer, centered
```

### Photo with Tag
```
[Photo Frame]
  ┌─Tag─┐ ← Gold badge overlay
```

### Story Cards
```
┌─────┐
│Photo│ ← Card 1
└─────┘
  ┌─────┐
  │Photo│ ← Card 2 (offset)
  └─────┘
    ┌─────┐
    │Photo│ ← Card 3 (offset)
    └─────┘
```

