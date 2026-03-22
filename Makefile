CYBERNETICS.pdf : CYBERNETICS.md
	pandoc CYBERNETICS.md -o CYBERNETICS.pdf
clean:
	rm CYBERNETICS.pdf || true
