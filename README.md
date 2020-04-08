# bigNumbers
The aim of this repository is to generate well investigated ordered lists of big numbers.

To achieve this goal, there are various folders in the order how data should trespass the process:
* New_data (These are data you have found somewhere but not processed yet)
* Scripts (Scripts to process data into ordered lists)
* Ordered_data (Now data should be already in the ordered form but still may lack information)
* Reviewed_data (Here data should have their proof like links and all necessary datafields should be filled out.)
* Ready_lists (Here data are distributed to several ready to use lists.)

It's not obligatory that data always treaspass all these stages. Sometimes data might directly jump into <ordered_data> i.e.

The ready_lists should be in TSV format:

Number | Unit | Year | perYear | Title | Short description | Link_Icon | Link1 (Source) | Link2 (Wikipedia) | Link3 (ourWiki) CR LF
where | is a Tab-Character to separate columns chr$(9) and CR = chr$(13) and LF = chr$(10).

1. The first line of the ready_list_file should be built up like:
   BN-V1.0 | ListName | YearOfCreation | LinkToAnIcon CR LF
2. The second line of the ready_list_file should be empty.
3. The third line of the ready_list_file should show the headers
4. The 4th and further lines shall contain the data.

There must be one folder per list that contains the icons associated with this list.
This folder shall have the same name as the list itself.
It must contain at least one icon with the same name as the list itself. This icon shall be used for the list itself.
