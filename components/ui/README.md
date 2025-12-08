# Ascendia UI Components

## Overview

This directory contains the UI components for the Ascendia application, built on top of [shadcn/ui](https://ui.shadcn.com/) and [Radix UI](https://www.radix-ui.com/). The components follow a consistent design system and are fully accessible, responsive, and theme-aware.

## Component Categories

### Core Components (shadcn/ui)
- **Button** - Interactive button with multiple variants and sizes
- **Input** - Text input field with validation states
- **Textarea** - Multi-line text input
- **Label** - Form labels with accessibility features
- **Badge** - Status indicators and tags
- **Card** - Content containers with headers and footers
- **Dialog** - Modal dialogs and overlays
- **Dropdown Menu** - Context menus and action lists
- **Tabs** - Tabbed content navigation
- **Avatar** - User profile images with fallbacks
- **Progress** - Progress bars and loading indicators
- **Skeleton** - Loading placeholders
- **Alert** - Notification messages
- **Popover** - Floating content containers
- **Separator** - Visual content dividers
- **Scroll Area** - Scrollable content areas
- **Toast** - Temporary notification messages

### Ascendia-Specific Components
- **CPL Score** - Content Polish Level score display with animations
- **Streaming Indicator** - Real-time processing status indicators
- **Content Editor** - Rich text editor with CPL integration
- **Theme Toggle** - Dark/light mode switcher

### Layout Components
- **Header** - Application header with navigation and user menu
- **Main Layout** - Root layout wrapper with theme provider

## Usage Examples

### CPL Score Component
```tsx
import { CPLScore } from '@/components/ui/cpl-score'

// Basic usage
<CPLScore score={85} />

// Inline variant with badge
<CPLScore score={85} variant="inline" showBadge={true} />

// Detailed view with progress
<CPLScore score={85} variant="detailed" animated={true} />
```

### Streaming Indicator
```tsx
import { StreamingIndicator } from '@/components/ui/streaming-indicator'

// Basic streaming status
<StreamingIndicator status="streaming" message="Processing your content..." />

// With progress
<StreamingIndicator
  status="streaming"
  progress={65}
  showProgress={true}
  message="Enhancing content..."
/>
```

### Content Editor
```tsx
import { ContentEditor } from '@/components/ui/content-editor'

<ContentEditor
  content={content}
  onContentChange={setContent}
  cplScore={85}
  isStreaming={isProcessing}
  streamingProgress={progress}
  draftType="adaptive_polish"
  onEnhance={handleEnhance}
  onRegenerate={handleRegenerate}
/>
```

### Main Layout
```tsx
import { MainLayout } from '@/components/layout/main-layout'

<MainLayout user={user} onSignOut={handleSignOut}>
  <div className="container py-6">
    {/* Your page content */}
  </div>
</MainLayout>
```

## Design System Integration

All components follow the Ascendia design system defined in `lib/design-system.ts`:

### Color Palette
- **Primary**: Blue tones for main actions and branding
- **Secondary**: Gray tones for secondary actions
- **Accent**: Yellow tones for highlights and warnings
- **Semantic**: Green (success), Red (error), Yellow (warning), Blue (info)
- **CPL Colors**: Dynamic colors based on score ranges

### Typography
- **Font Family**: Inter (sans), Georgia (serif), Fira Code (mono)
- **Scales**: xs, sm, base, lg, xl, 2xl, 3xl, 4xl, 5xl, 6xl
- **Weights**: light, normal, medium, semibold, bold, extrabold

### Spacing
Consistent spacing scale from 0.125rem to 24rem with logical increments.

### Component Variants
All components support multiple variants for different use cases:
- **Size variants**: sm, default, lg, xl
- **Style variants**: default, secondary, outline, ghost, etc.
- **State variants**: idle, loading, success, error

## Accessibility Features

All components are built with accessibility in mind:
- **Keyboard Navigation**: Full keyboard support
- **Screen Readers**: ARIA labels and descriptions
- **Focus Management**: Proper focus handling
- **Color Contrast**: WCAG AA compliant colors
- **Reduced Motion**: Respects user preferences

## Theme Support

The design system supports both light and dark modes:
- **CSS Variables**: Theme-aware color system
- **Theme Provider**: Next.js themes integration
- **Theme Toggle**: User-controlled theme switching
- **System Preference**: Automatic theme detection

## Component Structure

Each component follows a consistent structure:

```tsx
// Component definition with forwardRef
const Component = React.forwardRef<HTMLElement, ComponentProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <element
        ref={ref}
        className={cn(componentVariants({ variant, size, className }))}
        {...props}
      />
    )
  }
)

// Display name for debugging
Component.displayName = 'Component'

// Exports
export { Component, componentVariants }
```

## Adding New Components

To add a new component:

1. **Install via shadcn/ui** (if available):
   ```bash
   npx shadcn@latest add component-name
   ```

2. **Create custom component**:
   - Follow the component structure above
   - Use `cva` for variant definitions
   - Include proper TypeScript types
   - Add accessibility features
   - Document usage examples

3. **Update exports**:
   - Add to appropriate index files
   - Document in this README
   - Add to design system if needed

## Best Practices

### Component Design
- **Single Responsibility**: Each component has one clear purpose
- **Composition**: Components compose well together
- **Flexibility**: Support multiple use cases through variants
- **Consistency**: Follow established patterns and conventions

### Styling
- **Tailwind CSS**: Use Tailwind for all styling
- **CSS Variables**: Use theme variables for colors
- **Responsive Design**: Mobile-first responsive approach
- **Animation**: Subtle animations that respect accessibility

### TypeScript
- **Strict Types**: Comprehensive type definitions
- **Props Interface**: Clear prop interfaces with JSDoc
- **Variant Types**: Type-safe variant definitions
- **Ref Forwarding**: Proper ref forwarding for DOM access

### Testing
- **Accessibility**: Test with screen readers and keyboard navigation
- **Responsive**: Test across different screen sizes
- **Theme Support**: Test in both light and dark modes
- **User Interactions**: Test all interactive states

## Contributing

When contributing new components or modifications:

1. Follow the established patterns and conventions
2. Include comprehensive TypeScript types
3. Add accessibility features and ARIA labels
4. Test across different themes and screen sizes
5. Document usage examples and props
6. Update this README with new components

## Resources

- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Radix UI Documentation](https://www.radix-ui.com/primitives)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [WCAG Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [React TypeScript Best Practices](https://react-typescript-cheatsheet.netlify.app/)