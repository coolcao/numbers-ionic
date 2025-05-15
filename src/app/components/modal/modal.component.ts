import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: false,
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.css'
})
export class ModalComponent {
  @Input() isVisible = false;
  @Input() title = '';
  @Input() okButtonText = '确认';
  @Input() showCloseButton = true;
  @Input() closeOnBackdropClick = true;
  @Output() onClose = new EventEmitter<void>();
  @Output() onOk = new EventEmitter<void>();

  @HostListener('document:keydown.escape', ['$event'])
  onKeydownHandler(event: KeyboardEvent) {
    this.closeModal();
  }

  closeModal() {
    this.isVisible = false;
    this.onClose.emit();
  }

  onOkClick() {
    this.onOk.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if (this.closeOnBackdropClick && (event.target as HTMLElement).classList.contains('modal')) {
      this.closeModal();
    }
  }
}
