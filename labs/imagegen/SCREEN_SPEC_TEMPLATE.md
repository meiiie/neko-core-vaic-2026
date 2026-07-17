# Screen-spec template

Copy this file before requesting any visual concept. The spec is required even when the output is
only a pitch/presentation image.

```md
# <ID> — <route/state>

## User and decision

- Role: <student | teacher | evaluator>
- Route: <existing route>
- State: <existing adapter/system state>
- One decision to support: <verb + object>
- Dominant action: <existing control/route>
- What must remain visible: <truth label / denominator / uncertainty / offline state>

## Data and behavior contract

- Source adapter/component: <path or named contract>
- Existing data only: <list>
- Empty/error/offline behavior: <list>
- Must not imply: <e.g. validated curriculum, real authentication, learning gain>
- No new model/domain/content requirement: confirmed

## Layout contract

- Desktop frame: 1440×900
- Mobile frame: 390×844
- First viewport hierarchy: <three items in order>
- Spacing tokens: <existing semantic tokens only>
- Type roles: <heading/body/metadata>
- Color meanings: <evidence/review/danger/focus>

## Accessibility and interaction

- Keyboard order: <ordered controls>
- Target sizes: <44 px task controls>
- Focus/announcement: <focus + role=status/alert>
- Reduced-motion behavior: <none / opacity>
- Pointer alternative to any drag: <not applicable or named control>

## Visual-lab request

- Prompt ID: <T01/S01/P01/...>
- Image role: <composition reference | pitch illustration | raster asset candidate>
- Text policy: blank placeholders only; code owns all exact text
- Reviewers: <human + AI visual pass>
- Acceptance hypothesis: <what should become easier to understand?>
```

