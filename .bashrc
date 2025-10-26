# If not running interactively, don't do anything (leave this at the top of this file)
[[ $- != *i* ]] && return

# All the default Omarchy aliases and functions
# (don't mess with these directly, just overwrite them here!)
source ~/.local/share/omarchy/default/bash/rc

# Add your own exports, aliases, and functions here.
#
# Make an alias for invoking commands you use constantly
# alias p='python'

# cd ./projects
alias config="cd ~/.config/nvim && nvim"
alias windows="cd /mnt/c/Users/danny/"
alias sv="source venv/bin/activate"
alias pydev="python3 -m venv venv && sv && pip install --upgrade pip"
alias p="python3"
alias g="g++ -o"

# Dotfiles management
alias config='/usr/bin/git --git-dir=$HOME/.dotfiles/ --work-tree=$HOME'
alias lazydots='GIT_DIR=$HOME/.dotfiles GIT_WORK_TREE=$HOME lazygit'
