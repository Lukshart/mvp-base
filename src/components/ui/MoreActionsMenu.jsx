import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ellipsis } from "lucide-react";
import AppIcon from "./AppIcon";

// Ancho del menú (debe coincidir con .ui-more-actions__menu) y alto estimado
// por opción y de su relleno, para ubicarlo bajo o sobre el botón sin salir
// de la ventana.
const MENU_WIDTH = 224;
const ITEM_HEIGHT = 44;
const MENU_PADDING = 16;

// Menú de acciones secundarias. iconOnly muestra solo el ícono (filas de
// tablas); sin iconOnly, el botón lleva el rótulo y el ícono. actions:
// [{label, onSelect, disabled}]; las entradas vacías se ignoran.
// triggerClassName reemplaza el estilo del botón cuando el menú debe verse
// como los demás botones de su barra (por ejemplo, "Importar").
function MoreActionsMenu({
  actions,
  disabled,
  icon = Ellipsis,
  iconOnly = false,
  label = "Más acciones",
  menuLabel = label,
  triggerClassName = "",
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const itemRefs = useRef([]);
  const menuId = React.useId();
  const items = (actions || []).filter(Boolean);

  useEffect(() => {
    if (!open) return undefined;

    const closeMenu = () => setOpen(false);
    const handlePointerDown = (event) => {
      if (
        !triggerRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        closeMenu();
      }
    };
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeMenu();
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [open]);

  const openMenu = (focusLast = false) => {
    const trigger = triggerRef.current;
    if (!trigger || disabled) return;

    const rect = trigger.getBoundingClientRect();
    const estimatedHeight = items.length * ITEM_HEIGHT + MENU_PADDING;
    const left = Math.max(
      8,
      Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)
    );
    const below = rect.bottom + 6;
    const top = below + estimatedHeight <= window.innerHeight - 8
      ? below
      : Math.max(8, rect.top - estimatedHeight - 6);

    setPosition({ left, top });
    setOpen(true);
    window.requestAnimationFrame(() => {
      const availableItems = itemRefs.current.filter(
        (item) => item && !item.disabled
      );
      const targetIndex = focusLast ? availableItems.length - 1 : 0;
      availableItems[targetIndex]?.focus();
    });
  };

  const handleMenuKeyDown = (event) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const availableItems = itemRefs.current.filter(
      (item) => item && !item.disabled
    );
    if (!availableItems.length) return;
    const currentIndex = availableItems.indexOf(document.activeElement);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? availableItems.length - 1
        : event.key === "ArrowDown"
          ? (currentIndex + 1 + availableItems.length) % availableItems.length
          : (currentIndex - 1 + availableItems.length) % availableItems.length;
    availableItems[nextIndex]?.focus();
  };

  const handleSelect = (action) => {
    setOpen(false);
    triggerRef.current?.focus();
    action.onSelect();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName || `ui-more-actions${iconOnly ? " ui-more-actions--icon" : ""}`}
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled}
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (!open && ["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            openMenu(event.key === "ArrowUp");
          }
        }}
      >
        {!iconOnly && <span>{label}</span>}
        <AppIcon icon={icon} size={17} />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label={menuLabel}
          className="ui-more-actions__menu"
          onKeyDown={handleMenuKeyDown}
          style={position}
        >
          {items.map((action, index) => (
            <button
              key={action.label}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              role="menuitem"
              className="ui-more-actions__item"
              disabled={action.disabled}
              onClick={() => handleSelect(action)}
            >
              {action.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

export default MoreActionsMenu;
