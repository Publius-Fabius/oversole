README.html : README.md
	pandoc README.md -o README.html
clean:
	rm README.html || true
