# Sound Effects Directory

This directory contains sound effect files organized by type. Each sound type has its own folder.

## Structure

```
sounds/
├── click/          # Button click sounds
├── playerJoin/     # Player joined game sounds
├── countdown/      # Countdown tick sounds
├── countdownFinal/ # Final countdown sounds
├── gameStart/      # Game start fanfare sounds
├── lieSubmit/      # Lie submission sounds
├── voteSubmit/     # Vote submission sounds
├── revealLie/      # Reveal lie (wrong answer) sounds
├── revealTruth/    # Reveal truth (correct answer) sounds
├── scoreUp/        # Score increase sounds
├── roundEnd/       # Round end sounds
├── victory/        # Victory fanfare sounds
├── tick/           # Tick sounds
├── whoosh/         # Whoosh/transition sounds
├── pop/            # Pop sounds
└── error/          # Error sounds
```

## Adding Sound Files

1. **Add your sound files** to the appropriate directory (e.g., `click/click2.mp3`)
2. **Run the manifest generator** to update the file list:
   ```bash
   npm run generate-sounds
   ```
   Or from the client directory:
   ```bash
   node scripts/generate-sound-manifests.js
   ```

## Supported Formats

- `.mp3`
- `.ogg`
- `.wav`
- `.m4a`
- `.aac`
- `.webm`

## How It Works

- The game automatically discovers sound files using `manifest.json` files in each directory
- When multiple files exist in a directory, the game randomly selects one each time
- If no sound files are found, the game falls back to synthesized sounds
- Sound files are cached for better performance

## Background Music

The background music file (`Quirky-Puzzle-Game-Menu.ogg`) stays in the root `sounds/` directory and is not part of the sound effect system.

