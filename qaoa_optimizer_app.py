#!/usr/bin/env python3
"""
QAOA Portfolio Optimizer - GUI Application
Standalone executable that reads Excel input, runs quantum/classical optimization, and writes results back.
"""

import sys
import tkinter as tk
from tkinter import filedialog, messagebox, ttk, scrolledtext
import threading
import traceback
from pathlib import Path
import io
from contextlib import redirect_stdout, redirect_stderr

# Import the optimizer logic
from qaoa_optimizer_core import QAOAOptimizer, OptimizationError


class OptimizerGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("QAOA Portfolio Optimizer")
        self.root.geometry("800x650")
        
        self.optimizer = None
        self.optimizer_thread = None
        self.is_running = False
        
        self._setup_ui()

    @staticmethod
    def _is_main_thread():
        """Return True when running on tkinter's UI thread."""
        return threading.current_thread() is threading.main_thread()

    def _call_on_ui_thread(self, fn):
        """Run UI work safely from background threads."""
        if self._is_main_thread():
            fn()
        else:
            self.root.after(0, fn)
        
    def _setup_ui(self):
        """Create the GUI layout."""
        # Main frame with padding
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(0, weight=1)
        main_frame.rowconfigure(5, weight=1)
        
        # Title
        title_label = ttk.Label(main_frame, text="QAOA Portfolio Optimizer", font=("Helvetica", 16, "bold"))
        title_label.grid(row=0, column=0, columnspan=3, pady=(0, 15))
        
        # File selection section
        file_frame = ttk.LabelFrame(main_frame, text="Input File", padding="10")
        file_frame.grid(row=1, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 10))
        file_frame.columnconfigure(1, weight=1)
        
        self.file_path_var = tk.StringVar()
        file_entry = ttk.Entry(file_frame, textvariable=self.file_path_var, width=50)
        file_entry.grid(row=0, column=1, padx=(10, 5), sticky=(tk.W, tk.E))
        
        browse_btn = ttk.Button(file_frame, text="Browse", command=self._browse_file)
        browse_btn.grid(row=0, column=2, padx=5)
        
        # Settings section
        settings_frame = ttk.LabelFrame(main_frame, text="Optimization Settings", padding="10")
        settings_frame.grid(row=2, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 10))
        settings_frame.columnconfigure(1, weight=1)
        
        # Enable/Disable options
        self.refresh_data_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(settings_frame, text="Refresh Market Data from Yahoo Finance", variable=self.refresh_data_var).grid(row=0, column=0, columnspan=2, sticky=tk.W, pady=5)
        
        self.enable_qaoa_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(settings_frame, text="Enable QAOA Optimization", variable=self.enable_qaoa_var).grid(row=1, column=0, columnspan=2, sticky=tk.W, pady=5)
        
        self.enable_classical_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(settings_frame, text="Enable Classical Search", variable=self.enable_classical_var).grid(row=2, column=0, columnspan=2, sticky=tk.W, pady=5)
        
        # QAOA parameters
        ttk.Label(settings_frame, text="QAOA Layers (p):").grid(row=3, column=0, sticky=tk.W, pady=(10, 5))
        self.qaoa_p_var = tk.StringVar(value="1")
        ttk.Spinbox(settings_frame, from_=1, to=5, textvariable=self.qaoa_p_var, width=10).grid(row=3, column=1, sticky=tk.W, pady=(10, 5))
        
        ttk.Label(settings_frame, text="QAOA Max Iterations:").grid(row=4, column=0, sticky=tk.W, pady=5)
        self.qaoa_maxiter_var = tk.StringVar(value="60")
        ttk.Spinbox(settings_frame, from_=10, to=500, textvariable=self.qaoa_maxiter_var, width=10).grid(row=4, column=1, sticky=tk.W, pady=5)
        
        # Control buttons frame
        control_frame = ttk.Frame(main_frame)
        control_frame.grid(row=3, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 10))
        
        self.run_btn = ttk.Button(control_frame, text="▶ Run Optimization", command=self._run_optimization)
        self.run_btn.pack(side=tk.LEFT, padx=5)
        
        self.stop_btn = ttk.Button(control_frame, text="⏹ Stop", command=self._stop_optimization, state=tk.DISABLED)
        self.stop_btn.pack(side=tk.LEFT, padx=5)
        
        ttk.Button(control_frame, text="Exit", command=self.root.quit).pack(side=tk.RIGHT, padx=5)
        
        # Progress section
        progress_frame = ttk.LabelFrame(main_frame, text="Status", padding="10")
        progress_frame.grid(row=4, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 10))
        progress_frame.columnconfigure(0, weight=1)
        
        self.status_label = ttk.Label(progress_frame, text="Ready", foreground="blue")
        self.status_label.grid(row=0, column=0, sticky=tk.W, pady=(0, 5))
        
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(progress_frame, variable=self.progress_var, maximum=100, mode='determinate')
        self.progress_bar.grid(row=1, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # Output log section
        log_frame = ttk.LabelFrame(main_frame, text="Execution Log", padding="10")
        log_frame.grid(row=5, column=0, columnspan=3, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 0))
        log_frame.columnconfigure(0, weight=1)
        log_frame.rowconfigure(0, weight=1)
        
        self.log_text = scrolledtext.ScrolledText(log_frame, height=10, width=80, state=tk.DISABLED)
        self.log_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
    def _browse_file(self):
        """Browse for Excel file."""
        filename = filedialog.askopenfilename(
            title="Select Excel file",
            filetypes=[("Excel files", "*.xlsx"), ("All files", "*.*")]
        )
        if filename:
            self.file_path_var.set(filename)
            
    def _log_message(self, message):
        """Add message to log."""
        def update():
            self.log_text.config(state=tk.NORMAL)
            self.log_text.insert(tk.END, message + "\n")
            self.log_text.see(tk.END)
            self.log_text.config(state=tk.DISABLED)
            self.root.update_idletasks()

        self._call_on_ui_thread(update)
        
    def _update_status(self, message, progress=None):
        """Update status label and progress bar."""
        def update():
            self.status_label.config(text=message)
            if progress is not None:
                self.progress_var.set(progress)
            self.root.update_idletasks()

        self._call_on_ui_thread(update)
        
    def _run_optimization(self):
        """Run optimization in a separate thread."""
        xlsx_path = self.file_path_var.get()
        
        if not xlsx_path or not Path(xlsx_path).exists():
            messagebox.showerror("Error", "Please select a valid Excel file")
            return
            
        # Clear log and reset progress
        self.log_text.config(state=tk.NORMAL)
        self.log_text.delete(1.0, tk.END)
        self.log_text.config(state=tk.DISABLED)
        self.progress_var.set(0)
        
        # Disable run button, enable stop button
        self.run_btn.config(state=tk.DISABLED)
        self.stop_btn.config(state=tk.NORMAL)
        self.is_running = True
        
        # Run in separate thread
        self.optimizer_thread = threading.Thread(
            target=self._optimization_worker,
            args=(xlsx_path,),
            daemon=True
        )
        self.optimizer_thread.start()
        
    def _stop_optimization(self):
        """Stop the running optimization."""
        self.is_running = False
        self._update_status("Stopping...", 0)
        
    def _optimization_worker(self, xlsx_path):
        """Worker thread for optimization."""
        try:
            self._update_status("Initializing...", 5)
            self._log_message("=" * 70)
            self._log_message("Starting QAOA Portfolio Optimization")
            self._log_message("=" * 70)
            
            # Create optimizer
            self.optimizer = QAOAOptimizer(
                xlsx_path=xlsx_path,
                refresh_data=self.refresh_data_var.get(),
                enable_qaoa=self.enable_qaoa_var.get(),
                enable_classical=self.enable_classical_var.get(),
                qaoa_p=int(self.qaoa_p_var.get()),
                qaoa_maxiter=int(self.qaoa_maxiter_var.get()),
                progress_callback=self._update_status,
                log_callback=self._log_message,
                stop_check=lambda: not self.is_running
            )
            
            self._update_status("Loading Excel file...", 10)
            self.optimizer.load_input()
            
            if not self.is_running:
                self._log_message("Optimization cancelled by user")
                return
                
            self._update_status("Loading market data...", 20)
            if self.refresh_data_var.get():
                self.optimizer.refresh_market_data()
            
            if not self.is_running:
                self._log_message("Optimization cancelled by user")
                return
                
            self._update_status("Building optimization problem...", 30)
            self.optimizer.build_qubo()
            
            if not self.is_running:
                self._log_message("Optimization cancelled by user")
                return
                
            if self.enable_classical_var.get():
                self._update_status("Running classical optimization...", 40)
                self.optimizer.run_classical_search()
            
            if not self.is_running:
                self._log_message("Optimization cancelled by user")
                return
                
            if self.enable_qaoa_var.get():
                self._update_status("Running QAOA optimization...", 60)
                self.optimizer.run_qaoa()
            
            if not self.is_running:
                self._log_message("Optimization cancelled by user")
                return
                
            self._update_status("Generating results...", 80)
            self.optimizer.generate_results()
            
            if not self.is_running:
                self._log_message("Optimization cancelled by user")
                return
                
            self._update_status("Writing results to Excel...", 90)
            self.optimizer.write_results()
            
            self._update_status("✓ Optimization complete!", 100)
            self._log_message("=" * 70)
            self._log_message("Results written to Excel successfully!")
            self._log_message("=" * 70)
            self.root.after(0, lambda: messagebox.showinfo("Success", "Optimization complete! Results written to Excel."))
            
        except Exception as e:
            self._update_status("✗ Error occurred", 0)
            self._log_message(f"\n{'='*70}")
            self._log_message("ERROR:")
            self._log_message(f"{str(e)}")
            self._log_message(traceback.format_exc())
            self._log_message(f"{'='*70}\n")
            self.root.after(0, lambda e=e: messagebox.showerror("Error", f"An error occurred:\n\n{str(e)}"))
            
        finally:
            def finalize():
                self.run_btn.config(state=tk.NORMAL)
                self.stop_btn.config(state=tk.DISABLED)
                self.is_running = False

            self.root.after(0, finalize)


def main():
    root = tk.Tk()
    gui = OptimizerGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
