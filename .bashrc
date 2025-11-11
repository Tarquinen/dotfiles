# If not running interactively, don't do anything (leave this at the top of this file)
[[ $- != *i* ]] && return

# All the default Omarchy aliases and functions
# (don't mess with these directly, just overwrite them here!)
source ~/.local/share/omarchy/default/bash/rc

# ============================================================================
# Environment Variables
# ============================================================================
export BUN_INSTALL="$HOME/.bun"
export OPENCODE_DISABLE_DEFAULT_PLUGINS=1

# ============================================================================
# PATH
# ============================================================================
export PATH="$BUN_INSTALL/bin:$PATH"

# ============================================================================
# Source Additional Files
# ============================================================================
# Source secrets (not in version control)
[ -f ~/.bash_secrets ] && source ~/.bash_secrets

# ============================================================================
# Aliases
# ============================================================================
alias config="cd ~/.config/nvim && nvim"
alias v="nvim"
alias sv="source venv/bin/activate"
alias pydev="python3 -m venv venv && sv && pip install --upgrade pip"
alias p="python3"
alias g="g++ -o"
alias lazydots='GIT_DIR=$HOME/.dotfiles GIT_WORK_TREE=$HOME lazygit'
alias ld='GIT_DIR=$HOME/.dotfiles GIT_WORK_TREE=$HOME lazygit'
alias oc="opencode"

# ============================================================================
# Functions
# ============================================================================
dotfiles() {
    if [[ "$1" == "add" ]] && [[ "$2" != /* ]] && [[ "$2" != ~* ]]; then
        local rel_to_home="${PWD#$HOME/}"
        if [[ "$PWD" == "$HOME" ]]; then
            (cd "$HOME" && /usr/bin/git --git-dir=$HOME/.dotfiles/ --work-tree=$HOME add --force "$2")
        elif [[ "$rel_to_home" != "$PWD" ]]; then
            (cd "$HOME" && /usr/bin/git --git-dir=$HOME/.dotfiles/ --work-tree=$HOME add --force "$rel_to_home/$2")
        else
            echo "Error: Not in home directory tree"
            return 1
        fi
    else
        (cd "$HOME" && /usr/bin/git --git-dir=$HOME/.dotfiles/ --work-tree=$HOME "$@")
    fi
}
