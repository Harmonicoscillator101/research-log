using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        try
        {
            string root = AppDomain.CurrentDomain.BaseDirectory;
            string python = Path.Combine(root, "runtime", "python", "pythonw.exe");
            string launcher = Path.Combine(root, "launch.py");

            if (!File.Exists(python) || !File.Exists(launcher))
            {
                MessageBox.Show(
                    "Program files are missing.\r\nExpected: " + python,
                    "Research Log",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return;
            }

            var info = new ProcessStartInfo
            {
                FileName = python,
                Arguments = "\"" + launcher + "\"",
                WorkingDirectory = root,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            Process.Start(info);
        }
        catch (Exception error)
        {
            MessageBox.Show(error.Message, "Research Log", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
