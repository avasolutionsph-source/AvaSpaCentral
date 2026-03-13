import React, { useState, useRef, useCallback, useEffect, memo } from 'react';

/**
 * ManageOrder - Reusable drag-and-drop reorder modal
 *
 * Allows users to rearrange items by dragging them to their preferred order.
 * Uses HTML5 Drag and Drop API (no external libraries).
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Array} props.items - Items to reorder (must have _id)
 * @param {Function} props.onSave - Called with reordered items array on save
 * @param {string} props.title - Modal title (default: "Manage Order")
 * @param {Function} props.renderLabel - Function to render item label (receives item)
 * @param {Function} props.renderSubLabel - Optional function to render sub-label
 * @param {boolean} props.saving - Whether save is in progress
 */
const ManageOrder = memo(function ManageOrder({
  isOpen,
  onClose,
  items = [],
  onSave,
  title = 'Manage Order',
  renderLabel = (item) => item.name || item._id,
  renderSubLabel,
  saving = false
}) {
  const [orderedItems, setOrderedItems] = useState([]);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const prevOpenRef = useRef(false);
  const dragIndexRef = useRef(null);

  // Keep dragIndexRef in sync with state (avoids stale closure in handlers)
  useEffect(() => {
    dragIndexRef.current = dragIndex;
  }, [dragIndex]);

  // Only sync items when modal OPENS (false -> true), not on every items change
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = isOpen;

    if (isOpen && !wasOpen && items.length > 0) {
      setOrderedItems([...items]);
      setDragIndex(null);
      setOverIndex(null);
    }
  }, [isOpen, items]);

  const handleDragStart = useCallback((e, index) => {
    setDragIndex(index);
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const currentDrag = dragIndexRef.current;
    if (currentDrag === null || currentDrag === index) return;
    setOverIndex(index);
  }, []);

  const handleDrop = useCallback((e, dropIndex) => {
    e.preventDefault();
    const currentDrag = dragIndexRef.current;
    if (currentDrag === null || currentDrag === dropIndex) return;

    setOrderedItems(prev => {
      const newItems = [...prev];
      const [dragged] = newItems.splice(currentDrag, 1);
      newItems.splice(dropIndex, 0, dragged);
      return newItems;
    });

    setDragIndex(null);
    setOverIndex(null);
    dragIndexRef.current = null;
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
    dragIndexRef.current = null;
  }, []);

  // Move item up/down with buttons (accessibility)
  const moveItem = useCallback((fromIndex, direction) => {
    setOrderedItems(prev => {
      const toIndex = fromIndex + direction;
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const newItems = [...prev];
      [newItems[fromIndex], newItems[toIndex]] = [newItems[toIndex], newItems[fromIndex]];
      return newItems;
    });
  }, []);

  const handleSave = useCallback(() => {
    onSave(orderedItems);
  }, [orderedItems, onSave]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal manage-order-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body manage-order-body">
          <p className="manage-order-hint">
            Drag and drop items to rearrange their display order, or use the arrow buttons.
          </p>

          <div className="manage-order-list">
            {orderedItems.map((item, index) => (
              <div
                key={item._id}
                className={`manage-order-item${dragIndex === index ? ' manage-order-dragging' : ''}${overIndex === index ? ' manage-order-over' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
              >
                <div className="manage-order-handle">
                  <span className="manage-order-grip">&#x2630;</span>
                </div>
                <span className="manage-order-number">{index + 1}</span>
                <div className="manage-order-label">
                  <span className="manage-order-name">{renderLabel(item)}</span>
                  {renderSubLabel && (
                    <span className="manage-order-sub">{renderSubLabel(item)}</span>
                  )}
                </div>
                <div className="manage-order-arrows">
                  <button
                    className="manage-order-arrow"
                    onClick={() => moveItem(index, -1)}
                    disabled={index === 0}
                    title="Move up"
                  >
                    &#9650;
                  </button>
                  <button
                    className="manage-order-arrow"
                    onClick={() => moveItem(index, 1)}
                    disabled={index === orderedItems.length - 1}
                    title="Move down"
                  >
                    &#9660;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Order'}
          </button>
        </div>
      </div>
    </div>
  );
});

export default ManageOrder;
