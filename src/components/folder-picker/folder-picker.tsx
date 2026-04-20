import { useState } from 'react';
import type { Folder } from '../../types';
import styles from './folder-picker.module.scss';

interface FolderPickerProps {
  onSelect: (folder: Folder) => void;
}

/**
 * Dev-only fallback. In production, folder(s) are injected via
 * PP_VARIABLES.FOLDERS so this screen never renders.
 */
export default function FolderPicker({ onSelect }: FolderPickerProps) {
  const [folderId, setFolderId] = useState('');

  const submit = () => {
    const trimmed = folderId.trim();

    if (!trimmed) {
      return;
    }

    onSelect({ id: trimmed, name: `Folder ${trimmed}`, reportCount: 0 });
  };

  return (
    <div className={styles.screen}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.mark}>S</div>
            <div className={styles.eyebrow}>Report Slideshow</div>
          </div>
          <h1 className={styles.title}>Enter a Folder ID</h1>
          <p className={styles.subtitle}>
            In production this app is configured via <code>PP_VARIABLES.FOLDERS</code>.
            For local development, enter a Metric Insights folder id to preview.
          </p>
        </div>

        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            placeholder="e.g. 171"
            className={styles.input}
            autoFocus
          />
          <button type="submit" className={styles.submit} disabled={!folderId.trim()}>
            Start slideshow
          </button>
        </form>
      </div>
    </div>
  );
}
